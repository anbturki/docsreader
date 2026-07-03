#[derive(Debug, Default)]
pub(crate) struct DocMeta {
    pub title: Option<String>,
    pub tags: Vec<String>,
}

pub(crate) fn split_frontmatter(content: &str) -> (Option<&str>, &str) {
    let trimmed = content.trim_start_matches('\u{feff}').trim_start();
    let Some(after) = trimmed.strip_prefix("---") else {
        return (None, content);
    };
    let Some(nl) = after.find('\n') else {
        return (None, content);
    };
    let rest = &after[nl + 1..];
    let Some(end) = rest.find("\n---") else {
        return (None, content);
    };
    let fm = &rest[..end];
    let after_fence = &rest[end + 4..];
    let body = match after_fence.find('\n') {
        Some(i) => &after_fence[i + 1..],
        None => "",
    };
    (Some(fm), body)
}

fn yaml_str(map: &serde_yaml::Mapping, key: &str) -> Option<String> {
    map.get(serde_yaml::Value::String(key.into()))
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

pub(crate) fn parse_doc_meta(fm: &str) -> DocMeta {
    let Ok(value) = serde_yaml::from_str::<serde_yaml::Value>(fm) else {
        return DocMeta::default();
    };
    let Some(map) = value.as_mapping() else {
        return DocMeta::default();
    };
    DocMeta {
        title: yaml_str(map, "title"),
        tags: map
            .get(serde_yaml::Value::String("tags".into()))
            .map(parse_tags)
            .unwrap_or_default(),
    }
}

/// Replaces the top-level `key:` line inside the frontmatter, or appends it
/// after the existing keys (creating the frontmatter block if the content has
/// none). `line` is a full "key: value" line without a trailing newline;
/// everything else is preserved byte-for-byte.
pub(crate) fn upsert_fm_line(content: &str, key: &str, line: &str) -> String {
    let prefix = format!("{key}:");
    let Some(fm) = split_frontmatter(content).0 else {
        return format!("---\n{line}\n---\n\n{content}");
    };
    let new_fm = match fm.lines().position(|l| l.starts_with(&prefix)) {
        Some(i) => {
            let mut lines: Vec<&str> = fm.lines().collect();
            lines[i] = line;
            lines.join("\n")
        }
        None => format!("{}\n{line}", fm.trim_end()),
    };
    // fm borrows from content, so its offsets splice the exact byte range.
    let start = fm.as_ptr() as usize - content.as_ptr() as usize;
    let end = start + fm.len();
    format!("{}{}{}", &content[..start], new_fm, &content[end..])
}

/// One "key: value" YAML line with proper escaping, no trailing newline.
pub(crate) fn yaml_line(key: &str, value: &str) -> Result<String, crate::error::CoreError> {
    let mut map = serde_yaml::Mapping::new();
    map.insert(key.into(), value.into());
    serde_yaml::to_string(&map)
        .map(|s| s.trim_end().to_string())
        .map_err(|e| {
            crate::error::CoreError::new(
                crate::error::ErrorCode::Io,
                format!("serialize {key}: {e}"),
            )
        })
}

pub(crate) fn parse_tags(value: &serde_yaml::Value) -> Vec<String> {
    if let Some(seq) = value.as_sequence() {
        return seq
            .iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect();
    }
    if let Some(s) = value.as_str() {
        return s
            .split(',')
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect();
    }
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_frontmatter_and_body() {
        let (fm, body) = split_frontmatter("---\ntitle: X\ntags: [a]\n---\n\nBody here.");
        assert_eq!(fm, Some("title: X\ntags: [a]"));
        assert_eq!(body, "\nBody here.");

        let meta = parse_doc_meta(fm.unwrap());
        assert_eq!(meta.title.as_deref(), Some("X"));
        assert_eq!(meta.tags, vec!["a".to_string()]);
    }

    #[test]
    fn no_frontmatter_returns_full_body() {
        let (fm, body) = split_frontmatter("# Just a heading\n");
        assert_eq!(fm, None);
        assert_eq!(body, "# Just a heading\n");
    }
}
