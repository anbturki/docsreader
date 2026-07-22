use std::ops::Range;
use std::path::{Path, PathBuf};

use rayon::prelude::*;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};

use crate::error::{CoreError, ErrorCode};
use crate::frontmatter::split_frontmatter;
use crate::scan::{collect_markdown_entries, parse_meta, relative_path};
use crate::score::{combine_terms, FieldHits};

/// How many matching lines are returned per file. A single huge document must
/// not crowd every other result out of the list.
const MAX_LINES_PER_FILE: usize = 5;
/// Context kept before the first match on a line, in characters.
const SNIPPET_LEAD_CHARS: usize = 40;
/// Total snippet width, in characters.
const SNIPPET_WIDTH_CHARS: usize = 240;

/// A run of snippet text, already split so the caller never does index
/// arithmetic. Rust byte offsets and JavaScript UTF-16 indices disagree the
/// moment a document contains an emoji or an accent, so offsets must not cross
/// the process boundary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetSegment {
    pub text: String,
    pub is_match: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineMatch {
    /// 1-based, counted from the start of the file including any frontmatter.
    pub line: u32,
    pub segments: Vec<SnippetSegment>,
    pub leading_ellipsis: bool,
    pub trailing_ellipsis: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentHit {
    /// The searched folder this hit came from. Quick Open spans several
    /// workspaces at once and the same relative path can exist in more than
    /// one, so the caller cannot infer it from the paths alone.
    pub root: String,
    pub path: String,
    pub rel_path: String,
    pub score: u32,
    pub lines: Vec<LineMatch>,
    /// Total matching lines in the file, which may exceed `lines.len()`.
    pub matched_lines: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchResult {
    pub hits: Vec<ContentHit>,
    /// True when a newer query superseded this one, so the hits are partial.
    pub aborted: bool,
    pub truncated: bool,
}

impl ContentSearchResult {
    pub fn empty() -> Self {
        Self {
            hits: Vec::new(),
            aborted: false,
            truncated: false,
        }
    }
}

/// Lets the caller stop an in-flight search. Tauri commands cannot be
/// cancelled, so a superseded query has to bail out cooperatively.
pub trait SearchAbort: Sync {
    fn is_aborted(&self) -> bool;
}

pub struct NeverAborts;

impl SearchAbort for NeverAborts {
    fn is_aborted(&self) -> bool {
        false
    }
}

/// Which fields a query is allowed to match. Mirrored in TypeScript as
/// SEARCH_SCOPES; keep the two in step.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SearchScope {
    #[default]
    All,
    Names,
    Content,
    Tags,
}

impl SearchScope {
    fn matches_name(self) -> bool {
        matches!(self, Self::All | Self::Names)
    }

    fn matches_content(self) -> bool {
        matches!(self, Self::All | Self::Content)
    }

    fn matches_tag(self) -> bool {
        matches!(self, Self::All | Self::Tags)
    }
}

pub struct ContentQuery {
    terms: Vec<Regex>,
    scope: SearchScope,
}

impl ContentQuery {
    /// Returns `None` for a query with no searchable terms.
    pub fn parse(query: &str, case_sensitive: bool, scope: SearchScope) -> Option<Self> {
        let terms: Vec<Regex> = query
            .split_whitespace()
            .filter_map(|term| build_term(term, case_sensitive))
            .collect();
        if terms.is_empty() {
            return None;
        }
        Some(Self { terms, scope })
    }
}

// The pattern is escaped, so the input is matched literally and a stray "(" in
// the search box cannot become a regex. Case folding is left to the regex
// engine because lowercasing the haystack is not length-preserving, which would
// misalign every offset used to build snippets.
fn build_term(term: &str, case_sensitive: bool) -> Option<Regex> {
    RegexBuilder::new(&regex::escape(term))
        .case_insensitive(!case_sensitive)
        .build()
        .ok()
}

pub fn search_content(
    root: &Path,
    query: &ContentQuery,
    abort: &dyn SearchAbort,
) -> Result<ContentSearchResult, CoreError> {
    if !root.is_dir() {
        return Err(CoreError::new(
            ErrorCode::WorkspaceNotFound,
            format!("folder {} is missing", root.display()),
        )
        .with_recovery("reopen the folder to rescan it"));
    }

    let walk = collect_markdown_entries(root, |_| {});
    let mut hits: Vec<ContentHit> = walk
        .entries
        .par_iter()
        .filter_map(|entry| {
            if abort.is_aborted() {
                return None;
            }
            search_file(root, entry.path(), query)
        })
        .collect();

    sort_hits(&mut hits);

    Ok(ContentSearchResult {
        hits,
        aborted: abort.is_aborted(),
        truncated: walk.truncated,
    })
}

/// Searches several folders as one request. Quick Open spans every open
/// workspace, and running one request per folder would make them cancel each
/// other, since a newer request marks every older one stale.
pub fn search_roots(
    roots: &[PathBuf],
    query: &ContentQuery,
    abort: &dyn SearchAbort,
) -> ContentSearchResult {
    let mut hits = Vec::new();
    let mut truncated = false;
    for root in roots {
        // One unreadable folder must not sink a search across the others.
        let Ok(result) = search_content(root, query, abort) else {
            continue;
        };
        truncated = truncated || result.truncated;
        hits.extend(result.hits);
    }
    sort_hits(&mut hits);
    ContentSearchResult {
        hits,
        aborted: abort.is_aborted(),
        truncated,
    }
}

fn sort_hits(hits: &mut [ContentHit]) {
    hits.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| a.rel_path.cmp(&b.rel_path))
    });
}

struct DocFields<'a> {
    title: Option<&'a str>,
    tags: &'a [String],
    /// File stem plus the workspace-relative path, so a query can match a
    /// folder name the way it matches a file name.
    name: &'a str,
    body: &'a str,
}

fn search_file(root: &Path, path: &Path, query: &ContentQuery) -> Option<ContentHit> {
    // A file deleted or made unreadable between the walk and the read is simply
    // not a result; the next scan reconciles the tree.
    let content = std::fs::read_to_string(path).ok()?;
    let (_, body) = split_frontmatter(&content);
    let (title, tags) = parse_meta(&content);
    let rel_path = relative_path(root, path);

    let fields = DocFields {
        title: title.as_deref(),
        tags: &tags,
        name: &rel_path,
        body,
    };
    let score = combine_terms(
        query
            .terms
            .iter()
            .map(|term| field_hits(term, &fields, query.scope)),
    );
    if score == 0 {
        return None;
    }

    let (lines, matched_lines) = if query.scope.matches_content() {
        matching_lines(body, first_body_line(&content, body), &query.terms)
    } else {
        (Vec::new(), 0)
    };

    Some(ContentHit {
        root: root.to_string_lossy().to_string(),
        path: path.to_string_lossy().to_string(),
        rel_path,
        score,
        lines,
        matched_lines,
    })
}

fn field_hits(term: &Regex, fields: &DocFields<'_>, scope: SearchScope) -> FieldHits {
    FieldHits {
        title: scope.matches_name() && fields.title.is_some_and(|t| term.is_match(t)),
        tag: scope.matches_tag() && fields.tags.iter().any(|tag| term.is_match(tag)),
        slug: scope.matches_name() && term.is_match(fields.name),
        content: scope.matches_content() && term.is_match(fields.body),
    }
}

/// 1-based file line on which the body starts, so reported line numbers point
/// at the real file rather than at the post-frontmatter offset. `body` is a
/// subslice of `content`, so the length gap is exactly the frontmatter block.
fn first_body_line(content: &str, body: &str) -> u32 {
    let consumed = content.len() - body.len();
    content[..consumed].matches('\n').count() as u32 + 1
}

fn matching_lines(body: &str, first_line: u32, terms: &[Regex]) -> (Vec<LineMatch>, u32) {
    let mut lines = Vec::new();
    let mut matched = 0u32;
    for (offset, line) in body.lines().enumerate() {
        let ranges = merge_overlapping(term_ranges(line, terms));
        if ranges.is_empty() {
            continue;
        }
        matched += 1;
        if lines.len() < MAX_LINES_PER_FILE {
            lines.push(build_line_match(first_line + offset as u32, line, &ranges));
        }
    }
    (lines, matched)
}

fn term_ranges(line: &str, terms: &[Regex]) -> Vec<Range<usize>> {
    let mut ranges: Vec<Range<usize>> = terms
        .iter()
        .flat_map(|term| term.find_iter(line).map(|m| m.range()))
        .collect();
    ranges.sort_by_key(|r| (r.start, r.end));
    ranges
}

fn merge_overlapping(ranges: Vec<Range<usize>>) -> Vec<Range<usize>> {
    let mut merged: Vec<Range<usize>> = Vec::with_capacity(ranges.len());
    for range in ranges {
        match merged.last_mut() {
            Some(last) if range.start <= last.end => last.end = last.end.max(range.end),
            _ => merged.push(range),
        }
    }
    merged
}

fn build_line_match(line: u32, text: &str, ranges: &[Range<usize>]) -> LineMatch {
    let first_match = ranges.first().map(|r| r.start).unwrap_or(0);
    let window = snippet_window(text, first_match);
    LineMatch {
        line,
        segments: build_segments(text, &window, ranges),
        leading_ellipsis: window.start > 0,
        trailing_ellipsis: window.end < text.len(),
    }
}

fn snippet_window(text: &str, first_match: usize) -> Range<usize> {
    let start = back_off_chars(text, first_match, SNIPPET_LEAD_CHARS);
    let end = forward_chars(text, start, SNIPPET_WIDTH_CHARS);
    start..end
}

fn back_off_chars(text: &str, from: usize, chars: usize) -> usize {
    text[..from]
        .char_indices()
        .rev()
        .take(chars)
        .last()
        .map(|(i, _)| i)
        .unwrap_or(from)
}

fn forward_chars(text: &str, from: usize, chars: usize) -> usize {
    text[from..]
        .char_indices()
        .nth(chars)
        .map(|(i, _)| from + i)
        .unwrap_or(text.len())
}

fn build_segments(
    text: &str,
    window: &Range<usize>,
    ranges: &[Range<usize>],
) -> Vec<SnippetSegment> {
    let mut segments = Vec::new();
    let mut cursor = window.start;
    for range in ranges {
        if range.start < cursor || range.end > window.end {
            continue;
        }
        push_segment(&mut segments, &text[cursor..range.start], false);
        push_segment(&mut segments, &text[range.start..range.end], true);
        cursor = range.end;
    }
    push_segment(&mut segments, &text[cursor..window.end], false);
    segments
}

fn push_segment(segments: &mut Vec<SnippetSegment>, text: &str, is_match: bool) {
    if text.is_empty() {
        return;
    }
    segments.push(SnippetSegment {
        text: text.to_string(),
        is_match,
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace::test_dir;

    struct AlwaysAborts;

    impl SearchAbort for AlwaysAborts {
        fn is_aborted(&self) -> bool {
            true
        }
    }

    fn write(root: &Path, rel: &str, content: &str) {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(path, content).unwrap();
    }

    fn search(root: &Path, query: &str) -> Vec<ContentHit> {
        search_scoped(root, query, SearchScope::All)
    }

    fn search_scoped(root: &Path, query: &str, scope: SearchScope) -> Vec<ContentHit> {
        let parsed = ContentQuery::parse(query, false, scope).expect("query has terms");
        search_content(root, &parsed, &NeverAborts).unwrap().hits
    }

    fn matched_text(hit: &ContentHit) -> Vec<String> {
        hit.lines
            .iter()
            .flat_map(|l| l.segments.iter())
            .filter(|s| s.is_match)
            .map(|s| s.text.clone())
            .collect()
    }

    #[test]
    fn finds_a_term_only_present_in_the_body() {
        let dir = test_dir("search_body");
        write(
            &dir,
            "notes.md",
            "# Unrelated Title\n\nthe coturn relay flag\n",
        );

        let hits = search(&dir, "coturn");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].rel_path, "notes.md");
        assert_eq!(matched_text(&hits[0]), ["coturn"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn finds_a_term_beyond_the_partial_read_window() {
        let dir = test_dir("search_deep");
        let filler = "lorem ipsum dolor sit amet\n".repeat(2000);
        write(
            &dir,
            "long.md",
            &format!("# Long\n\n{filler}\nneedle here\n"),
        );

        let hits = search(&dir, "needle");
        assert_eq!(
            hits.len(),
            1,
            "content past the 16 KiB scan window is searched"
        );
        assert!(
            filler.len() > 16 * 1024,
            "fixture exceeds the scan read window"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn every_term_must_match_somewhere() {
        let dir = test_dir("search_and");
        write(&dir, "both.md", "alpha and beta\n");
        write(&dir, "one.md", "alpha only\n");

        let hits = search(&dir, "alpha beta");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].rel_path, "both.md");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn title_match_outranks_body_match() {
        let dir = test_dir("search_rank");
        write(
            &dir,
            "body.md",
            "# Something Else\n\nmentions gateway once\n",
        );
        write(
            &dir,
            "titled.md",
            "---\ntitle: Gateway\n---\n\nunrelated prose\n",
        );

        let hits = search(&dir, "gateway");
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].rel_path, "titled.md");
        assert!(hits[0].score > hits[1].score);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn reports_file_line_numbers_past_frontmatter() {
        let dir = test_dir("search_lines");
        write(
            &dir,
            "fm.md",
            "---\ntitle: X\ntags: [a]\n---\n\nfirst\ntarget line\n",
        );

        let hits = search(&dir, "target");
        assert_eq!(hits[0].lines[0].line, 7);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn frontmatter_only_match_does_not_count_as_content() {
        let dir = test_dir("search_fm_only");
        write(&dir, "tagged.md", "---\ntags: [infra]\n---\n\nbody text\n");

        let hits = search(&dir, "infra");
        assert_eq!(hits.len(), 1, "the tag still matches");
        assert!(hits[0].lines.is_empty(), "but no body line is reported");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn query_metacharacters_are_matched_literally() {
        let dir = test_dir("search_meta");
        write(&dir, "regex.md", "a.b literal\n");
        write(&dir, "other.md", "axb should not match\n");

        let hits = search(&dir, "a.b");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].rel_path, "regex.md");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn case_insensitive_by_default_and_case_sensitive_on_request() {
        let dir = test_dir("search_case");
        write(&dir, "case.md", "Gateway rules\n");

        assert_eq!(search(&dir, "gateway").len(), 1);

        let sensitive = ContentQuery::parse("gateway", true, SearchScope::All).unwrap();
        let hits = search_content(&dir, &sensitive, &NeverAborts).unwrap().hits;
        assert!(hits.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn segments_survive_multibyte_content() {
        let dir = test_dir("search_utf8");
        write(&dir, "emoji.md", "café ☕ needle 😀 tail\n");

        let hits = search(&dir, "needle");
        let joined: String = hits[0].lines[0]
            .segments
            .iter()
            .map(|s| s.text.as_str())
            .collect();
        assert!(joined.contains("café ☕"));
        assert!(joined.contains('😀'));
        assert_eq!(matched_text(&hits[0]), ["needle"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn overlapping_term_matches_merge_into_one_segment() {
        let dir = test_dir("search_overlap");
        write(&dir, "overlap.md", "foobar\n");

        let parsed = ContentQuery::parse("foo oob", false, SearchScope::All).unwrap();
        let hits = search_content(&dir, &parsed, &NeverAborts).unwrap().hits;
        assert_eq!(matched_text(&hits[0]), ["foob"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn caps_reported_lines_but_counts_them_all() {
        let dir = test_dir("search_cap");
        write(&dir, "many.md", &"needle\n".repeat(MAX_LINES_PER_FILE + 4));

        let hits = search(&dir, "needle");
        assert_eq!(hits[0].lines.len(), MAX_LINES_PER_FILE);
        assert_eq!(hits[0].matched_lines as usize, MAX_LINES_PER_FILE + 4);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn long_lines_are_windowed_with_ellipses() {
        let dir = test_dir("search_window");
        let pad = "x".repeat(400);
        write(&dir, "long_line.md", &format!("{pad} needle {pad}\n"));

        let hits = search(&dir, "needle");
        let line = &hits[0].lines[0];
        assert!(line.leading_ellipsis);
        assert!(line.trailing_ellipsis);
        let width: usize = line.segments.iter().map(|s| s.text.chars().count()).sum();
        assert!(width <= SNIPPET_WIDTH_CHARS, "snippet stays bounded");
        let _ = std::fs::remove_dir_all(&dir);
    }

    fn seed_scoped(tag: &str) -> std::path::PathBuf {
        let dir = test_dir(tag);
        write(
            &dir,
            "gateway-notes.md",
            "---\ntags: [infra]\n---\n\nplain prose\n",
        );
        write(
            &dir,
            "other.md",
            "---\ntitle: Unrelated\n---\n\nthe gateway is here\n",
        );
        write(
            &dir,
            "tagged.md",
            "---\ntags: [gateway]\n---\n\nplain prose\n",
        );
        dir
    }

    #[test]
    fn names_scope_matches_the_file_name_only() {
        let dir = seed_scoped("scope_names");

        let hits = search_scoped(&dir, "gateway", SearchScope::Names);

        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].rel_path, "gateway-notes.md");
        assert!(
            hits[0].lines.is_empty(),
            "no body snippet outside the content scope"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn content_scope_matches_the_body_only() {
        let dir = seed_scoped("scope_content");

        let hits = search_scoped(&dir, "gateway", SearchScope::Content);

        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].rel_path, "other.md");
        assert_eq!(hits[0].lines.len(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn tags_scope_matches_the_tags_only() {
        let dir = seed_scoped("scope_tags");

        let hits = search_scoped(&dir, "gateway", SearchScope::Tags);

        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].rel_path, "tagged.md");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn all_scope_matches_every_field() {
        let dir = seed_scoped("scope_all");

        let hits = search_scoped(&dir, "gateway", SearchScope::All);

        assert_eq!(hits.len(), 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn names_scope_matches_a_folder_in_the_path() {
        let dir = test_dir("scope_folder");
        write(&dir, "gateway/inner.md", "unrelated prose\n");

        let hits = search_scoped(&dir, "gateway", SearchScope::Names);

        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].rel_path, "gateway/inner.md");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn scope_defaults_to_searching_everything() {
        assert_eq!(SearchScope::default(), SearchScope::All);
    }

    #[test]
    fn searches_several_folders_in_one_request() {
        let one = test_dir("roots_one");
        let two = test_dir("roots_two");
        write(&one, "a.md", "the needle is here\n");
        write(&two, "b.md", "another needle\n");

        let parsed = ContentQuery::parse("needle", false, SearchScope::All).unwrap();
        let result = search_roots(&[one.clone(), two.clone()], &parsed, &NeverAborts);

        assert_eq!(result.hits.len(), 2);
        let roots: Vec<&str> = result.hits.iter().map(|h| h.root.as_str()).collect();
        assert!(roots.contains(&one.to_string_lossy().as_ref()));
        assert!(roots.contains(&two.to_string_lossy().as_ref()));
        let _ = std::fs::remove_dir_all(&one);
        let _ = std::fs::remove_dir_all(&two);
    }

    #[test]
    fn a_missing_folder_does_not_sink_the_others() {
        let good = test_dir("roots_good");
        let missing = test_dir("roots_missing");
        write(&good, "a.md", "needle\n");
        let _ = std::fs::remove_dir_all(&missing);

        let parsed = ContentQuery::parse("needle", false, SearchScope::All).unwrap();
        let result = search_roots(&[missing, good.clone()], &parsed, &NeverAborts);

        assert_eq!(result.hits.len(), 1);
        let _ = std::fs::remove_dir_all(&good);
    }

    #[test]
    fn every_hit_reports_the_folder_it_came_from() {
        let dir = test_dir("roots_reported");
        write(&dir, "a.md", "needle\n");

        let hits = search_scoped(&dir, "needle", SearchScope::All);

        assert_eq!(hits[0].root, dir.to_string_lossy());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn no_matches_returns_no_hits() {
        let dir = test_dir("search_none");
        write(&dir, "a.md", "nothing relevant\n");

        assert!(search(&dir, "absent").is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn blank_query_has_no_terms() {
        assert!(ContentQuery::parse("   ", false, SearchScope::All).is_none());
        assert!(ContentQuery::parse("", false, SearchScope::All).is_none());
    }

    #[test]
    fn abort_stops_the_search_and_is_reported() {
        let dir = test_dir("search_abort");
        write(&dir, "a.md", "needle\n");

        let parsed = ContentQuery::parse("needle", false, SearchScope::All).unwrap();
        let result = search_content(&dir, &parsed, &AlwaysAborts).unwrap();
        assert!(result.aborted);
        assert!(result.hits.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_folder_is_an_error() {
        let dir = test_dir("search_missing");
        let _ = std::fs::remove_dir_all(&dir);
        let parsed = ContentQuery::parse("x", false, SearchScope::All).unwrap();
        assert!(search_content(&dir, &parsed, &NeverAborts).is_err());
    }

    #[test]
    fn skips_non_utf8_files_without_failing_the_search() {
        let dir = test_dir("search_binary");
        write(&dir, "good.md", "needle\n");
        std::fs::write(dir.join("bad.md"), [0xff, 0xfe, 0x00, 0x6e]).unwrap();

        let hits = search(&dir, "needle");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].rel_path, "good.md");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn query_longer_than_the_file_matches_nothing() {
        let dir = test_dir("search_long_query");
        write(&dir, "tiny.md", "hi\n");

        assert!(search(&dir, "a query far longer than the document").is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn honours_the_scan_skip_rules() {
        let dir = test_dir("search_skips");
        write(&dir, "visible.md", "needle\n");
        write(&dir, "node_modules/hidden.md", "needle\n");
        write(&dir, ".hidden/secret.md", "needle\n");

        let hits = search(&dir, "needle");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].rel_path, "visible.md");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
