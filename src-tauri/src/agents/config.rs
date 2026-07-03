use std::fs;
use std::path::Path;

use serde_json::{json, Map, Value};

use super::SERVER_NAME;

pub fn read_json_command(path: &Path, top_key: &str) -> Option<String> {
    let text = fs::read_to_string(path).ok()?;
    let root: Value = serde_json::from_str(&text).ok()?;
    root.get(top_key)?
        .get(SERVER_NAME)?
        .get("command")?
        .as_str()
        .map(str::to_owned)
}

pub fn upsert_json_server(
    path: &Path,
    top_key: &str,
    entry_type: bool,
    command: &str,
) -> Result<(), String> {
    let mut root = match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str::<Value>(&text).map_err(|e| {
            format!(
                "{} is not valid JSON ({e}); fix the file or add this entry under \"{top_key}\" manually: {}",
                path.display(),
                json_entry(entry_type, command)
            )
        })?,
        Err(_) => Value::Object(Map::new()),
    };
    let obj = root
        .as_object_mut()
        .ok_or_else(|| format!("{} does not contain a JSON object", path.display()))?;
    let servers = obj
        .entry(top_key)
        .or_insert_with(|| Value::Object(Map::new()));
    let servers = servers
        .as_object_mut()
        .ok_or_else(|| format!("\"{top_key}\" in {} is not a JSON object", path.display()))?;
    servers.insert(SERVER_NAME.into(), json_entry(entry_type, command));
    write_atomic(path, &format!("{:#}\n", root))
}

fn json_entry(entry_type: bool, command: &str) -> Value {
    if entry_type {
        json!({ "type": "stdio", "command": command })
    } else {
        json!({ "command": command })
    }
}

pub fn read_toml_command(path: &Path) -> Option<String> {
    let text = fs::read_to_string(path).ok()?;
    let doc: toml_edit::DocumentMut = text.parse().ok()?;
    doc.get("mcp_servers")?
        .get(SERVER_NAME)?
        .get("command")?
        .as_str()
        .map(str::to_owned)
}

pub fn upsert_toml_server(path: &Path, command: &str) -> Result<(), String> {
    let text = fs::read_to_string(path).unwrap_or_default();
    let mut doc: toml_edit::DocumentMut = text.parse().map_err(|e| {
        format!(
            "{} is not valid TOML ({e}); fix the file or add this entry manually: [mcp_servers.{SERVER_NAME}] command = \"{command}\"",
            path.display()
        )
    })?;
    let servers = doc
        .entry("mcp_servers")
        .or_insert(toml_edit::table())
        .as_table_mut()
        .ok_or_else(|| format!("mcp_servers in {} is not a table", path.display()))?;
    servers.set_implicit(true);
    let mut entry = toml_edit::Table::new();
    entry["command"] = toml_edit::value(command);
    servers.insert(SERVER_NAME, toml_edit::Item::Table(entry));
    write_atomic(path, &doc.to_string())
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("{} has no parent directory", path.display()))?;
    fs::create_dir_all(parent).map_err(|e| format!("create {}: {e}", parent.display()))?;
    let tmp = path.with_extension("docsreader-tmp");
    fs::write(&tmp, content).map_err(|e| format!("write {}: {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("replace {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp() -> tempfile::TempDir {
        tempfile::tempdir().expect("tempdir")
    }

    #[test]
    fn json_upsert_creates_file_and_reads_back() {
        let dir = tmp();
        let path = dir.path().join("nested/mcp.json");
        upsert_json_server(&path, "mcpServers", false, "/bin/x").unwrap();
        assert_eq!(
            read_json_command(&path, "mcpServers").as_deref(),
            Some("/bin/x")
        );
        let text = fs::read_to_string(&path).unwrap();
        assert!(!text.contains("\"type\""));
    }

    #[test]
    fn json_upsert_preserves_other_servers_and_keys() {
        let dir = tmp();
        let path = dir.path().join("claude.json");
        fs::write(
            &path,
            r#"{"zTrailing": 1, "mcpServers": {"other": {"command": "keep"}}, "aLeading": {"x": true}}"#,
        )
        .unwrap();
        upsert_json_server(&path, "mcpServers", true, "/bin/x").unwrap();
        let text = fs::read_to_string(&path).unwrap();
        let root: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(root["mcpServers"]["other"]["command"], "keep");
        assert_eq!(root["mcpServers"][SERVER_NAME]["type"], "stdio");
        assert_eq!(root["zTrailing"], 1);
        assert_eq!(root["aLeading"]["x"], true);
        let z = text.find("zTrailing").unwrap();
        let a = text.find("aLeading").unwrap();
        assert!(z < a, "original key order must be preserved");
    }

    #[test]
    fn json_upsert_replaces_existing_docsreader_entry() {
        let dir = tmp();
        let path = dir.path().join("mcp.json");
        upsert_json_server(&path, "servers", true, "/old").unwrap();
        upsert_json_server(&path, "servers", true, "/new").unwrap();
        assert_eq!(read_json_command(&path, "servers").as_deref(), Some("/new"));
    }

    #[test]
    fn json_upsert_rejects_invalid_json_without_touching_file() {
        let dir = tmp();
        let path = dir.path().join("mcp.json");
        fs::write(&path, "{ not json").unwrap();
        let err = upsert_json_server(&path, "mcpServers", false, "/bin/x").unwrap_err();
        assert!(err.contains("not valid JSON"));
        assert!(err.contains("manually"));
        assert_eq!(fs::read_to_string(&path).unwrap(), "{ not json");
    }

    #[test]
    fn toml_upsert_preserves_comments_and_existing_servers() {
        let dir = tmp();
        let path = dir.path().join("config.toml");
        fs::write(
            &path,
            "# my codex config\nmodel = \"o4\"\n\n[mcp_servers.other]\ncommand = \"keep\"\n",
        )
        .unwrap();
        upsert_toml_server(&path, "/bin/x").unwrap();
        let text = fs::read_to_string(&path).unwrap();
        assert!(text.contains("# my codex config"));
        assert!(text.contains("model = \"o4\""));
        assert!(text.contains("[mcp_servers.other]"));
        assert!(text.contains(&format!("[mcp_servers.{SERVER_NAME}]")));
        assert!(!text.contains("[mcp_servers]\n"), "no empty parent header");
        assert_eq!(read_toml_command(&path).as_deref(), Some("/bin/x"));
    }

    #[test]
    fn toml_upsert_creates_missing_file() {
        let dir = tmp();
        let path = dir.path().join("config.toml");
        upsert_toml_server(&path, "/bin/x").unwrap();
        assert_eq!(read_toml_command(&path).as_deref(), Some("/bin/x"));
    }
}
