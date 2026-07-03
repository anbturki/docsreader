mod config;

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const SERVER_NAME: &str = "docsreader";

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ClientId {
    ClaudeCode,
    Cursor,
    Windsurf,
    #[serde(rename = "vscode")]
    VsCode,
    Codex,
}

pub const CLIENT_IDS: [ClientId; 5] = [
    ClientId::ClaudeCode,
    ClientId::Cursor,
    ClientId::Windsurf,
    ClientId::VsCode,
    ClientId::Codex,
];

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ConnectionStatus {
    Connected,
    Stale,
    Disconnected,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentClient {
    pub id: ClientId,
    pub name: &'static str,
    pub detected: bool,
    pub status: ConnectionStatus,
    pub config_path: String,
}

enum ConfigFormat {
    Json {
        top_key: &'static str,
        entry_type: bool,
    },
    Toml,
}

struct ClientSpec {
    name: &'static str,
    detect: Vec<PathBuf>,
    config: PathBuf,
    format: ConfigFormat,
}

// Config locations and shapes verified against each client's docs
// (Claude Code: code.claude.com/docs/en/mcp; Cursor: cursor.com/docs/context/mcp;
// VS Code: code.visualstudio.com/docs/copilot/customization/mcp-servers;
// Windsurf: docs.windsurf.com/windsurf/cascade/mcp; Codex: developers.openai.com/codex/mcp).
fn spec(id: ClientId, home: &Path) -> ClientSpec {
    match id {
        ClientId::ClaudeCode => ClientSpec {
            name: "Claude Code",
            detect: vec![home.join(".claude.json"), home.join(".claude")],
            config: home.join(".claude.json"),
            format: ConfigFormat::Json {
                top_key: "mcpServers",
                entry_type: true,
            },
        },
        ClientId::Cursor => ClientSpec {
            name: "Cursor",
            detect: vec![home.join(".cursor")],
            config: home.join(".cursor").join("mcp.json"),
            format: ConfigFormat::Json {
                top_key: "mcpServers",
                entry_type: false,
            },
        },
        ClientId::Windsurf => ClientSpec {
            name: "Windsurf",
            detect: vec![home.join(".codeium").join("windsurf")],
            config: home
                .join(".codeium")
                .join("windsurf")
                .join("mcp_config.json"),
            format: ConfigFormat::Json {
                top_key: "mcpServers",
                entry_type: false,
            },
        },
        ClientId::VsCode => ClientSpec {
            name: "VS Code",
            detect: vec![vscode_user_dir(home)],
            config: vscode_user_dir(home).join("mcp.json"),
            format: ConfigFormat::Json {
                top_key: "servers",
                entry_type: true,
            },
        },
        ClientId::Codex => ClientSpec {
            name: "Codex",
            detect: vec![home.join(".codex")],
            config: home.join(".codex").join("config.toml"),
            format: ConfigFormat::Toml,
        },
    }
}

// Same folder as settings.json (code.visualstudio.com/docs/configure/settings).
fn vscode_user_dir(home: &Path) -> PathBuf {
    if cfg!(target_os = "macos") {
        home.join("Library")
            .join("Application Support")
            .join("Code")
            .join("User")
    } else if cfg!(windows) {
        home.join("AppData")
            .join("Roaming")
            .join("Code")
            .join("User")
    } else {
        home.join(".config").join("Code").join("User")
    }
}

pub fn sidecar_path(app_data_dir: &Path) -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| format!("resolve current executable: {e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| format!("{} has no parent directory", exe.display()))?;
    let bundled = dir.join(format!("docsreader-mcp{}", std::env::consts::EXE_SUFFIX));
    if std::env::var_os("APPIMAGE").is_none() {
        return Ok(bundled);
    }
    // AppImages mount at an ephemeral per-launch path, so registered commands
    // must point at a copy that outlives the mount. Refreshing on every
    // resolution keeps the copy current across app updates.
    stable_sidecar_copy(&bundled, &app_data_dir.join("bin"))
}

fn stable_sidecar_copy(bundled: &Path, bin_dir: &Path) -> Result<PathBuf, String> {
    let name = bundled
        .file_name()
        .ok_or_else(|| format!("{} has no file name", bundled.display()))?;
    let dest = bin_dir.join(name);
    std::fs::create_dir_all(bin_dir).map_err(|e| format!("create {}: {e}", bin_dir.display()))?;
    let tmp = dest.with_extension("docsreader-tmp");
    std::fs::copy(bundled, &tmp)
        .map_err(|e| format!("copy {} to {}: {e}", bundled.display(), tmp.display()))?;
    std::fs::rename(&tmp, &dest).map_err(|e| format!("replace {}: {e}", dest.display()))?;
    Ok(dest)
}

pub fn detect_clients(home: &Path, sidecar: &Path) -> Vec<AgentClient> {
    CLIENT_IDS
        .iter()
        .map(|&id| client_status(id, home, sidecar))
        .collect()
}

pub fn connect_client(home: &Path, sidecar: &Path, id: ClientId) -> Result<AgentClient, String> {
    if !sidecar.exists() {
        return Err(format!(
            "MCP server binary not found at {}; reinstall DocsReader (dev: cargo build -p docsreader-mcp)",
            sidecar.display()
        ));
    }
    let s = spec(id, home);
    let command = sidecar.to_string_lossy();
    match s.format {
        ConfigFormat::Json {
            top_key,
            entry_type,
        } => config::upsert_json_server(&s.config, top_key, entry_type, &command)?,
        ConfigFormat::Toml => config::upsert_toml_server(&s.config, &command)?,
    }
    Ok(client_status(id, home, sidecar))
}

fn client_status(id: ClientId, home: &Path, sidecar: &Path) -> AgentClient {
    let s = spec(id, home);
    let registered = match s.format {
        ConfigFormat::Json { top_key, .. } => config::read_json_command(&s.config, top_key),
        ConfigFormat::Toml => config::read_toml_command(&s.config),
    };
    let status = match registered {
        Some(cmd) if Path::new(&cmd) == sidecar => ConnectionStatus::Connected,
        Some(_) => ConnectionStatus::Stale,
        None => ConnectionStatus::Disconnected,
    };
    AgentClient {
        id,
        name: s.name,
        detected: s.detect.iter().any(|p| p.exists()),
        status,
        config_path: s.config.to_string_lossy().into_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn home() -> tempfile::TempDir {
        tempfile::tempdir().expect("tempdir")
    }

    fn find(clients: &[AgentClient], id: ClientId) -> &AgentClient {
        clients.iter().find(|c| c.id == id).expect("client present")
    }

    #[test]
    fn detects_installed_clients_only() {
        let dir = home();
        fs::create_dir_all(dir.path().join(".cursor")).unwrap();
        fs::create_dir_all(dir.path().join(".codex")).unwrap();
        let clients = detect_clients(dir.path(), Path::new("/bin/mcp"));
        assert_eq!(clients.len(), CLIENT_IDS.len());
        assert!(find(&clients, ClientId::Cursor).detected);
        assert!(find(&clients, ClientId::Codex).detected);
        assert!(!find(&clients, ClientId::ClaudeCode).detected);
        assert!(!find(&clients, ClientId::Windsurf).detected);
    }

    #[test]
    fn connect_then_status_is_connected_for_each_client() {
        let dir = home();
        let sidecar = dir.path().join("docsreader-mcp");
        fs::write(&sidecar, "").unwrap();
        for id in CLIENT_IDS {
            let client = connect_client(dir.path(), &sidecar, id).unwrap();
            assert_eq!(client.status, ConnectionStatus::Connected, "{:?}", id);
        }
    }

    #[test]
    fn stale_when_registered_command_points_elsewhere() {
        let dir = home();
        let old = dir.path().join("docsreader-mcp");
        fs::write(&old, "").unwrap();
        connect_client(dir.path(), &old, ClientId::Cursor).unwrap();
        let clients = detect_clients(dir.path(), Path::new("/new/docsreader-mcp"));
        assert_eq!(
            find(&clients, ClientId::Cursor).status,
            ConnectionStatus::Stale
        );
    }

    #[test]
    fn connect_fails_loud_when_sidecar_missing() {
        let dir = home();
        let missing = dir.path().join("docsreader-mcp");
        let err = connect_client(dir.path(), &missing, ClientId::Cursor).unwrap_err();
        assert!(err.contains("not found"));
        assert!(err.contains("reinstall"));
    }

    #[test]
    fn claude_code_entry_lands_under_top_level_mcp_servers_with_stdio_type() {
        let dir = home();
        let sidecar = dir.path().join("docsreader-mcp");
        fs::write(&sidecar, "").unwrap();
        fs::write(
            dir.path().join(".claude.json"),
            r#"{"numStartups": 5, "mcpServers": {"other": {"type": "http", "url": "https://x"}}}"#,
        )
        .unwrap();
        connect_client(dir.path(), &sidecar, ClientId::ClaudeCode).unwrap();
        let text = fs::read_to_string(dir.path().join(".claude.json")).unwrap();
        let root: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert_eq!(root["numStartups"], 5);
        assert_eq!(root["mcpServers"]["other"]["url"], "https://x");
        assert_eq!(root["mcpServers"][SERVER_NAME]["type"], "stdio");
        assert_eq!(
            root["mcpServers"][SERVER_NAME]["command"],
            sidecar.to_string_lossy().as_ref()
        );
    }

    #[test]
    fn vscode_entry_lands_under_servers_key() {
        let dir = home();
        let sidecar = dir.path().join("docsreader-mcp");
        fs::write(&sidecar, "").unwrap();
        connect_client(dir.path(), &sidecar, ClientId::VsCode).unwrap();
        let config = spec(ClientId::VsCode, dir.path()).config;
        let root: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(config).unwrap()).unwrap();
        assert_eq!(root["servers"][SERVER_NAME]["type"], "stdio");
    }

    #[test]
    fn stable_copy_lands_in_bin_dir_and_refreshes() {
        let dir = home();
        let bundled = dir.path().join("docsreader-mcp");
        let bin_dir = dir.path().join("data/bin");
        fs::write(&bundled, "v1").unwrap();
        let dest = stable_sidecar_copy(&bundled, &bin_dir).unwrap();
        assert_eq!(dest, bin_dir.join("docsreader-mcp"));
        assert_eq!(fs::read_to_string(&dest).unwrap(), "v1");
        fs::write(&bundled, "v2").unwrap();
        stable_sidecar_copy(&bundled, &bin_dir).unwrap();
        assert_eq!(fs::read_to_string(&dest).unwrap(), "v2");
    }

    #[cfg(unix)]
    #[test]
    fn stable_copy_preserves_executable_bit() {
        use std::os::unix::fs::PermissionsExt;
        let dir = home();
        let bundled = dir.path().join("docsreader-mcp");
        fs::write(&bundled, "bin").unwrap();
        fs::set_permissions(&bundled, fs::Permissions::from_mode(0o755)).unwrap();
        let dest = stable_sidecar_copy(&bundled, &dir.path().join("bin")).unwrap();
        let mode = fs::metadata(&dest).unwrap().permissions().mode();
        assert_ne!(mode & 0o111, 0, "executable bit lost: {mode:o}");
    }

    #[test]
    fn stable_copy_fails_loud_when_bundled_missing() {
        let dir = home();
        let missing = dir.path().join("docsreader-mcp");
        let err = stable_sidecar_copy(&missing, &dir.path().join("bin")).unwrap_err();
        assert!(err.contains("copy"), "unexpected error: {err}");
    }

    #[test]
    fn client_ids_serialize_kebab_case() {
        let ids: Vec<String> = CLIENT_IDS
            .iter()
            .map(|id| serde_json::to_string(id).unwrap())
            .collect();
        assert_eq!(
            ids,
            [
                "\"claude-code\"",
                "\"cursor\"",
                "\"windsurf\"",
                "\"vscode\"",
                "\"codex\""
            ]
        );
    }
}
