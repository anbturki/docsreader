use std::path::{Component, Path, PathBuf};

use crate::scan::is_markdown;

/// Workspace-relative markdown targets of the inline `[text](target)` links
/// in `content`, resolved against the linking file's own directory.
/// External URLs, absolute paths, and links escaping the workspace drop out.
pub fn links_from(content: &str, source_rel: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for target in inline_targets(content) {
        if let Some(resolved) = resolve_link(source_rel, target) {
            if !out.contains(&resolved) {
                out.push(resolved);
            }
        }
    }
    out
}

fn inline_targets(content: &str) -> impl Iterator<Item = &str> {
    content.split("](").skip(1).filter_map(|rest| {
        if let Some(stripped) = rest.strip_prefix('<') {
            stripped.split('>').next()
        } else {
            rest.split(')')
                .next()
                .and_then(|t| t.split_whitespace().next())
        }
    })
}

fn resolve_link(source_rel: &str, target: &str) -> Option<String> {
    let decoded = percent_decode(target.split('#').next().unwrap_or(""));
    if decoded.is_empty() || decoded.starts_with('/') {
        return None;
    }
    // A colon in the first segment means a scheme (https:, mailto:) or a
    // Windows drive - either way not a workspace-relative link.
    if decoded.split('/').next().is_some_and(|s| s.contains(':')) {
        return None;
    }
    if !is_markdown(&decoded) {
        return None;
    }

    let source_dir = Path::new(source_rel).parent().unwrap_or(Path::new(""));
    let mut stack: Vec<&std::ffi::OsStr> = Vec::new();
    for comp in source_dir
        .components()
        .chain(Path::new(&decoded).components())
    {
        match comp {
            Component::Normal(c) => stack.push(c),
            Component::ParentDir => {
                stack.pop()?;
            }
            Component::CurDir => {}
            Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    Some(
        stack
            .iter()
            .collect::<PathBuf>()
            .to_string_lossy()
            .into_owned(),
    )
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let decoded = (bytes[i] == b'%' && i + 2 < bytes.len())
            .then(|| u8::from_str_radix(&s[i + 1..i + 3], 16).ok())
            .flatten();
        match decoded {
            Some(b) => {
                out.push(b);
                i += 3;
            }
            None => {
                out.push(bytes[i]);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_and_resolves_relative_links() {
        let content = "See [a](./sibling.md), [b](../up/other.md), and [c](nested/deep.md).";
        assert_eq!(
            links_from(content, "docs/source.md"),
            ["docs/sibling.md", "up/other.md", "docs/nested/deep.md"]
        );
    }

    #[test]
    fn skips_external_absolute_anchor_and_non_markdown_targets() {
        let content = "[u](https://x.com/a.md) [m](mailto:a@b.md) [abs](/etc/a.md) \
                       [anchor](#section) [img](./pic.png) [code](./main.rs)";
        assert_eq!(links_from(content, "doc.md"), Vec::<String>::new());
    }

    #[test]
    fn strips_fragments_decodes_percent_and_handles_angle_form() {
        let content = "[a](./target.md#heading) [b](./my%20doc.md) [c](<./my doc.md>) \
                       [titled](./cited.md \"Title\")";
        assert_eq!(
            links_from(content, "doc.md"),
            ["target.md", "my doc.md", "cited.md"]
        );
    }

    #[test]
    fn drops_links_escaping_the_workspace_and_dedupes() {
        let content = "[esc](../../outside.md) [a](./a.md) [again](a.md)";
        assert_eq!(links_from(content, "sub/doc.md"), ["sub/a.md"]);
    }
}
