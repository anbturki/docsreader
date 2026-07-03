use std::path::{Component, Path, PathBuf};

use crate::error::{CoreError, ErrorCode};

const ENCODED_TRAVERSAL_MARKERS: &[&str] = &["%2e", "%2f", "%5c"];

fn invalid(relative: &str, why: &str) -> CoreError {
    CoreError::new(
        ErrorCode::InvalidPath,
        format!("invalid path {relative:?}: {why}"),
    )
    .with_recovery("use a relative path inside the workspace, e.g. \"guides/setup.md\"")
}

pub fn safe_join(root: &Path, relative: &str) -> Result<PathBuf, CoreError> {
    if relative.is_empty() {
        return Err(invalid(relative, "empty path"));
    }
    let lower = relative.to_ascii_lowercase();
    if ENCODED_TRAVERSAL_MARKERS.iter().any(|m| lower.contains(m)) {
        return Err(invalid(relative, "percent-encoded separator or dot"));
    }
    if relative.contains(':') {
        return Err(invalid(relative, "drive or stream separator"));
    }
    if relative.contains('\0') {
        return Err(invalid(relative, "NUL byte"));
    }
    let normalized = relative.replace('\\', "/");
    let rel_path = Path::new(&normalized);
    for component in rel_path.components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            Component::ParentDir => return Err(invalid(relative, "parent traversal")),
            Component::RootDir | Component::Prefix(_) => {
                return Err(invalid(relative, "absolute path"))
            }
        }
    }
    Ok(root.join(rel_path))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn join(rel: &str) -> Result<PathBuf, CoreError> {
        safe_join(Path::new("/ws"), rel)
    }

    #[test]
    fn accepts_normal_relative_paths() {
        assert_eq!(
            join("guides/setup.md").unwrap(),
            Path::new("/ws/guides/setup.md")
        );
        assert_eq!(join("./a.md").unwrap(), Path::new("/ws/a.md"));
        assert_eq!(join("目录/文件.md").unwrap(), Path::new("/ws/目录/文件.md"));
    }

    #[test]
    fn rejects_traversal_vectors() {
        for vector in [
            "",
            "../evil.md",
            "a/../../evil.md",
            "/etc/passwd",
            "C:\\evil.md",
            "c:/evil.md",
            "a\\..\\evil.md",
            "%2e%2e%2fevil.md",
            "%2E%2E/evil.md",
            "a%2fevil.md",
            "a%5cevil.md",
            "a\0.md",
        ] {
            let err = join(vector).unwrap_err();
            assert_eq!(err.code, ErrorCode::InvalidPath, "vector: {vector:?}");
        }
    }
}
