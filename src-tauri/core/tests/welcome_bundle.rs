use std::path::PathBuf;

use docsreader_core::workspace::load_marker;

fn welcome_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("core crate lives inside src-tauri")
        .join("resources/welcome")
}

#[test]
fn bundled_welcome_marker_is_a_valid_managed_workspace() {
    let dir = welcome_dir();
    let marker = load_marker(&dir)
        .expect("marker parses with the production loader")
        .expect("marker file present");
    assert_eq!(marker.slug, "docsreader-welcome");
    assert_eq!(marker.name.as_deref(), Some("DocsReader welcome"));
    let homepage = marker
        .homepage
        .expect("homepage set for first-run auto-open");
    assert!(
        dir.join(&homepage).is_file(),
        "homepage {homepage} missing from the bundle"
    );
}

#[test]
fn welcome_tour_teaches_agent_setup() {
    let page = welcome_dir().join("Getting started/Connect your AI agents.md");
    let body = std::fs::read_to_string(&page).expect("agents getting-started page exists");
    for needle in [
        "docsreader-mcp",
        "claude mcp add",
        "codex mcp add",
        "mcpServers",
    ] {
        assert!(
            body.contains(needle),
            "agents page lost setup step: {needle}"
        );
    }
}
