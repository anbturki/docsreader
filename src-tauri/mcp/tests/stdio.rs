//! End-to-end tests driving the real docsreader-mcp binary over stdio.
//! Each test gets an isolated HOME, so nothing touches the developer's
//! workspaces; any stray non-JSON byte on stdout fails the harness.

use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};

use serde_json::{Value, json};

struct McpClient {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    next_id: i64,
}

impl McpClient {
    fn spawn(home: &Path, envs: &[(&str, &str)], capabilities: Value) -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_docsreader-mcp"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            // The walk-up from cwd would otherwise reach the developer's own
            // workspaces, so an un-slugged call would leave the sandbox.
            .current_dir(home)
            .env("HOME", home)
            .envs(envs.iter().copied())
            .spawn()
            .expect("spawn docsreader-mcp");
        let stdin = child.stdin.take().unwrap();
        let stdout = BufReader::new(child.stdout.take().unwrap());
        let mut client = Self {
            child,
            stdin,
            stdout,
            next_id: 0,
        };
        client.request(
            "initialize",
            json!({
                "protocolVersion": "2025-11-25",
                "capabilities": capabilities,
                "clientInfo": {"name": "stdio-test", "version": "0"},
            }),
            no_server_requests,
        );
        client.notify("notifications/initialized");
        client
    }

    fn send(&mut self, value: Value) {
        let mut line = value.to_string();
        line.push('\n');
        self.stdin.write_all(line.as_bytes()).expect("write stdin");
        self.stdin.flush().expect("flush stdin");
    }

    fn notify(&mut self, method: &str) {
        self.send(json!({"jsonrpc": "2.0", "method": method}));
    }

    fn read_message(&mut self) -> Value {
        let mut line = String::new();
        let n = self.stdout.read_line(&mut line).expect("read stdout");
        assert!(n > 0, "server closed stdout unexpectedly");
        serde_json::from_str(&line).expect("stdout carried a non-JSON line")
    }

    /// Send a request and pump messages until its response arrives. Server-
    /// initiated requests (e.g. elicitation/create) are answered by
    /// `on_request`, which returns the result to reply with.
    fn request(
        &mut self,
        method: &str,
        params: Value,
        mut on_request: impl FnMut(&Value) -> Value,
    ) -> Value {
        self.next_id += 1;
        let id = self.next_id;
        self.send(json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params}));
        loop {
            let msg = self.read_message();
            if msg.get("id") == Some(&json!(id)) && msg.get("method").is_none() {
                assert!(
                    msg.get("error").is_none(),
                    "protocol error for {method}: {msg}"
                );
                return msg["result"].clone();
            }
            if let (Some(req_id), Some(_)) = (msg.get("id"), msg.get("method")) {
                let reply = on_request(&msg);
                let req_id = req_id.clone();
                self.send(json!({"jsonrpc": "2.0", "id": req_id, "result": reply}));
            }
        }
    }

    /// Call a tool; returns (payload parsed from the first text block, isError).
    fn call(&mut self, tool: &str, args: Value) -> (Value, bool) {
        self.call_with(tool, args, no_server_requests)
    }

    fn call_with(
        &mut self,
        tool: &str,
        args: Value,
        on_request: impl FnMut(&Value) -> Value,
    ) -> (Value, bool) {
        let result = self.request(
            "tools/call",
            json!({"name": tool, "arguments": args}),
            on_request,
        );
        let text = result["content"][0]["text"]
            .as_str()
            .expect("tool result carries a text block");
        let payload = serde_json::from_str(text).expect("tool text block is JSON");
        (payload, result["isError"].as_bool().unwrap_or(false))
    }
}

impl Drop for McpClient {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn no_server_requests(msg: &Value) -> Value {
    panic!("unexpected server-initiated request: {msg}");
}

fn temp_home() -> tempfile::TempDir {
    tempfile::tempdir().expect("tempdir")
}

fn init_project(client: &mut McpClient, home: &Path, slug: &str) -> String {
    let project = home.join(format!("{slug}-proj"));
    std::fs::create_dir_all(&project).unwrap();
    let (payload, is_err) = client.call(
        "init_workspace",
        json!({"path": project.to_str().unwrap(), "slug": slug}),
    );
    assert!(!is_err, "init_workspace failed: {payload}");
    project.to_str().unwrap().to_string()
}

#[test]
fn doc_lifecycle_round_trip() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    init_project(&mut c, home.path(), "life");

    let (doc, is_err) = c.call(
        "write_doc",
        json!({
            "title": "API Design",
            "body": "# API Design\n\nfirst draft",
            "status": "research",
            "workspace": "life",
            "tags": ["api"],
        }),
    );
    assert!(!is_err, "{doc}");
    assert_eq!(doc["ok"], true);
    assert_eq!(doc["slug"], "api-design");
    assert_eq!(doc["status"], "research");

    let (list, _) = c.call("list_docs", json!({"workspace": "life"}));
    assert_eq!(list["docs"].as_array().unwrap().len(), 1);
    let uri = list["docs"][0]["uri"].as_str().unwrap().to_string();
    assert!(uri.starts_with("docsreader://life/"), "{uri}");

    let (read, _) = c.call(
        "read_doc",
        json!({"path": "api-design", "workspace": "life", "response_format": "detailed"}),
    );
    assert!(read.to_string().contains("first draft"));

    let (updated, is_err) = c.call(
        "update_doc",
        json!({
            "path": "api-design",
            "old_str": "first draft",
            "new_str": "revised draft",
            "workspace": "life",
        }),
    );
    assert!(!is_err, "{updated}");
    let (read, _) = c.call(
        "read_doc",
        json!({"path": "api-design", "workspace": "life", "response_format": "detailed"}),
    );
    assert!(read.to_string().contains("revised draft"));

    let (moved, _) = c.call(
        "set_status",
        json!({"path": "api-design", "status": "in-progress", "workspace": "life"}),
    );
    assert!(
        moved["relPath"]
            .as_str()
            .unwrap()
            .starts_with("in-progress/")
    );

    let (archived, _) = c.call(
        "archive",
        json!({"path": "api-design", "workspace": "life"}),
    );
    assert!(
        archived["relPath"]
            .as_str()
            .unwrap()
            .starts_with("archived/")
    );

    let (list, _) = c.call(
        "list_docs",
        json!({"workspace": "life", "status": "archived"}),
    );
    assert_eq!(list["docs"].as_array().unwrap().len(), 1);
}

#[test]
fn resources_and_prompts_are_served() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    let project = init_project(&mut c, home.path(), "res");
    drop(c);
    // resources/list serves the ambient workspace; point it at the project.
    let mut c = McpClient::spawn(
        home.path(),
        &[("CLAUDE_PROJECT_DIR", project.as_str())],
        json!({}),
    );
    c.call(
        "write_doc",
        json!({"title": "Findings", "body": "insight", "status": "done", "workspace": "res"}),
    );

    let listed = c.request("resources/list", json!({}), no_server_requests);
    let uris: Vec<&str> = listed["resources"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|r| r["uri"].as_str())
        .collect();
    assert!(uris.contains(&"docsreader://onboarding"), "{uris:?}");

    let onboarding = c.request(
        "resources/read",
        json!({"uri": "docsreader://onboarding"}),
        no_server_requests,
    );
    let text = onboarding["contents"][0]["text"].as_str().unwrap();
    assert!(
        text.contains("workspace"),
        "onboarding should explain the model"
    );

    let doc_uri = uris
        .iter()
        .find(|u| u.starts_with("docsreader://res/"))
        .expect("written doc listed as a resource");
    let doc = c.request(
        "resources/read",
        json!({"uri": doc_uri}),
        no_server_requests,
    );
    assert!(
        doc["contents"][0]["text"]
            .as_str()
            .unwrap()
            .contains("insight")
    );

    let prompts = c.request("prompts/list", json!({}), no_server_requests);
    let names: Vec<&str> = prompts["prompts"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|p| p["name"].as_str())
        .collect();
    assert!(names.contains(&"start-task"), "{names:?}");
    assert!(names.contains(&"record-decision"), "{names:?}");

    let prompt = c.request(
        "prompts/get",
        json!({"name": "start-task", "arguments": {"title": "Ship v1"}}),
        no_server_requests,
    );
    assert!(!prompt["messages"].as_array().unwrap().is_empty());
}

#[test]
fn memory_last_write_wins_round_trip() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    init_project(&mut c, home.path(), "mem");

    let (first, is_err) = c.call(
        "write_memory",
        json!({"topic": "deploy target", "content": "we deploy to staging", "workspace": "mem"}),
    );
    assert!(!is_err, "{first}");
    let (second, _) = c.call(
        "write_memory",
        json!({"topic": "deploy target", "content": "we deploy to prod now", "workspace": "mem"}),
    );
    assert_eq!(second["created"], false, "overwrite, not new entry");

    let (found, _) = c.call(
        "search_memory",
        json!({"query": "deploy", "workspace": "mem"}),
    );
    let serialized = found.to_string();
    assert!(serialized.contains("prod now"));
    assert!(!serialized.contains("staging"), "old content must be gone");
    assert_eq!(found["memories"].as_array().unwrap().len(), 1);
}

#[test]
fn tasks_round_trip() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    init_project(&mut c, home.path(), "tsk");

    let (task, is_err) = c.call(
        "write_task",
        json!({
            "title": "Wire CI",
            "description": "Add the pipeline",
            "acceptance_criteria": ["pipeline runs on PR"],
            "workspace": "tsk",
        }),
    );
    assert!(!is_err, "{task}");
    let id = task["id"].as_str().unwrap().to_string();
    assert_eq!(task["status"], "To Do");

    let (moved, _) = c.call(
        "set_task_status",
        json!({"id": id, "status": "In Progress", "workspace": "tsk"}),
    );
    assert_eq!(moved["status"], "In Progress");

    let (checked, is_err) = c.call(
        "update_task",
        json!({
            "id": id,
            "old_str": "- [ ] #1 pipeline runs on PR",
            "new_str": "- [x] #1 pipeline runs on PR",
            "workspace": "tsk",
        }),
    );
    assert!(!is_err, "{checked}");

    let (list, _) = c.call(
        "list_tasks",
        json!({"workspace": "tsk", "status": "In Progress"}),
    );
    assert_eq!(list["tasks"].as_array().unwrap().len(), 1);
}

#[test]
fn traversal_and_unknown_slug_are_tool_errors_not_protocol_errors() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    init_project(&mut c, home.path(), "sec");

    let (payload, is_err) = c.call(
        "read_doc",
        json!({"path": "../../../etc/passwd", "workspace": "sec"}),
    );
    assert!(is_err, "traversal must be rejected: {payload}");
    assert!(payload["error"]["code"].is_string());

    let (payload, is_err) = c.call("list_docs", json!({"workspace": "ghost"}));
    assert!(is_err);
    assert_eq!(payload["error"]["code"], "workspace_not_found");
    assert!(
        payload["error"]["recovery"]
            .as_str()
            .unwrap()
            .contains("sec"),
        "recovery lists known workspaces: {payload}"
    );
}

#[test]
fn claude_project_dir_auto_selects_workspace() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    let project = init_project(&mut c, home.path(), "auto");
    drop(c);

    let mut c = McpClient::spawn(
        home.path(),
        &[("CLAUDE_PROJECT_DIR", project.as_str())],
        json!({}),
    );
    let (list, is_err) = c.call("list_docs", json!({}));
    assert!(!is_err, "{list}");
    assert_eq!(list["workspace"]["slug"], "auto");
}

#[test]
fn unknown_slug_offers_elicitation_picker_and_accept_resolves() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({"elicitation": {}}));
    init_project(&mut c, home.path(), "pick");

    let mut picker = None;
    let (list, is_err) = c.call_with("list_docs", json!({"workspace": "ghost"}), |msg| {
        assert_eq!(msg["method"], "elicitation/create");
        picker = Some(msg["params"].clone());
        json!({"action": "accept", "content": {"workspace": "pick"}})
    });
    assert!(!is_err, "{list}");
    assert_eq!(list["workspace"]["slug"], "pick");

    let picker = picker.expect("server sent an elicitation request");
    assert_eq!(picker["mode"], "form");
    let choices = &picker["requestedSchema"]["properties"]["workspace"]["enum"];
    assert!(
        choices.as_array().unwrap().contains(&json!("pick")),
        "{picker}"
    );
}

#[test]
fn elicitation_decline_falls_back_to_recovery_error() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({"elicitation": {}}));
    init_project(&mut c, home.path(), "dec");

    let (payload, is_err) = c.call_with(
        "list_docs",
        json!({"workspace": "ghost"}),
        |_| json!({"action": "decline"}),
    );
    assert!(is_err);
    assert_eq!(payload["error"]["code"], "workspace_not_found");
}

#[test]
fn list_workspaces_hides_a_workspace_whose_folder_is_gone() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    let kept = init_project(&mut c, home.path(), "kept");
    let deleted = init_project(&mut c, home.path(), "deleted");
    std::fs::remove_dir_all(&deleted).unwrap();

    let (payload, is_err) = c.call("list_workspaces", json!({}));
    assert!(!is_err, "{payload}");
    let slugs: Vec<&str> = payload["workspaces"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|w| w["slug"].as_str())
        .collect();
    assert_eq!(slugs, ["kept"], "deleted workspace still advertised");
    assert!(Path::new(&kept).is_dir());
}

#[test]
fn list_workspaces_reports_a_hand_edited_marker_slug() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    let project = init_project(&mut c, home.path(), "before");
    std::fs::write(
        Path::new(&project).join("notes/.docsreader.yaml"),
        "slug: after\n",
    )
    .unwrap();

    let (payload, is_err) = c.call("list_workspaces", json!({}));
    assert!(!is_err, "{payload}");
    assert_eq!(payload["workspaces"][0]["slug"], "after");

    let (docs, is_err) = c.call("list_docs", json!({"workspace": "after"}));
    assert!(!is_err, "the advertised slug must resolve: {docs}");
}

#[test]
fn init_refuses_a_second_workspace_at_the_same_root_and_a_taken_slug() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    let project = init_project(&mut c, home.path(), "acme-billing");
    let elsewhere = home.path().join("unrelated");
    std::fs::create_dir_all(&elsewhere).unwrap();

    let (payload, is_err) = c.call("init_workspace", json!({"path": project.as_str()}));
    assert!(is_err, "re-init must not duplicate a workspace: {payload}");
    assert_eq!(payload["error"]["code"], "conflict");
    assert!(
        payload["error"]["recovery"]
            .as_str()
            .unwrap()
            .contains("this is the workspace to use"),
        "recovery must send the caller back to the existing workspace: {payload}"
    );

    let (payload, is_err) = c.call(
        "init_workspace",
        json!({"path": elsewhere.to_str().unwrap(), "slug": "acme-billing"}),
    );
    assert!(is_err, "a taken slug must be refused: {payload}");
    assert_eq!(payload["error"]["code"], "conflict");
    assert!(
        payload["error"]["message"]
            .as_str()
            .unwrap()
            .contains(Path::new(&project).join("notes").to_str().unwrap()),
        "the refusal names the workspace already holding the slug: {payload}"
    );
    assert!(
        !elsewhere.join("notes").exists(),
        "the refused workspace must not be created"
    );

    let (list, _) = c.call("list_workspaces", json!({}));
    let slugs: Vec<&str> = list["workspaces"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|w| w["slug"].as_str())
        .collect();
    assert_eq!(slugs, ["acme-billing"], "no duplicate registration");
}

#[test]
fn workspace_tool_descriptions_tell_a_caller_to_list_first_and_name_the_project() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    let listed = c.request("tools/list", json!({}), no_server_requests);
    let description = |name: &str| -> String {
        listed["tools"]
            .as_array()
            .unwrap()
            .iter()
            .find(|t| t["name"] == json!(name))
            .unwrap_or_else(|| panic!("{name} is advertised"))["description"]
            .as_str()
            .unwrap_or_else(|| panic!("{name} carries a description"))
            .to_string()
    };

    let init = description("init_workspace");
    assert!(
        init.contains("Call list_workspaces first"),
        "init_workspace must send the caller to the listing first: {init}"
    );
    assert!(
        init.contains("never \"Notes\" or \"Docs\""),
        "init_workspace must rule out a generic name: {init}"
    );
    assert!(
        init.contains("already a workspace"),
        "init_workspace must say an existing workspace is the one to use: {init}"
    );

    let list = description("list_workspaces");
    assert!(
        list.contains("before init_workspace"),
        "list_workspaces must place itself ahead of creation: {list}"
    );

    let schema = listed["tools"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["name"] == json!("init_workspace"))
        .unwrap()["inputSchema"]["properties"]["name"]["description"]
        .as_str()
        .unwrap()
        .to_string();
    assert!(
        schema.contains("project or product"),
        "the name field must ask for a project-identifying name: {schema}"
    );
}

#[test]
fn the_user_workspace_reports_the_slug_it_was_given_once_it_exists() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));
    init_project(&mut c, home.path(), "notes");

    let (created, is_err) = c.call("init_workspace", json!({}));
    assert!(!is_err, "{created}");
    let slug = created["slug"].as_str().unwrap().to_string();
    assert_ne!(
        slug, "notes",
        "the project workspace already holds that slug"
    );

    let (doc, is_err) = c.call(
        "write_doc",
        json!({"title": "First", "body": "# First", "status": "research"}),
    );
    assert!(
        !is_err,
        "a real user workspace takes un-slugged writes: {doc}"
    );
    assert_eq!(doc["workspace"]["slug"], json!(slug));

    let (list, is_err) = c.call("list_docs", json!({"workspace": slug}));
    assert!(!is_err, "{list}");
    assert_eq!(
        list["docs"].as_array().unwrap().len(),
        1,
        "the reported slug must name the workspace the doc was written into"
    );
}

#[test]
fn an_un_slugged_write_in_a_clean_session_is_refused_not_absorbed_into_user_notes() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));

    let (listed, _) = c.call("list_workspaces", json!({}));
    assert_eq!(listed["defaultUserWorkspace"]["exists"], false);

    let writes = [
        (
            "write_doc",
            json!({"title": "Plan", "body": "# Plan", "status": "research"}),
        ),
        (
            "write_task",
            json!({"title": "Wire CI", "description": "Add the pipeline"}),
        ),
        (
            "write_memory",
            json!({"topic": "deploy target", "content": "staging"}),
        ),
    ];
    for (tool, args) in writes {
        let (payload, is_err) = c.call(tool, args);
        assert!(is_err, "{tool} must refuse without a workspace: {payload}");
        assert_eq!(payload["error"]["code"], "workspace_not_found", "{tool}");
        assert!(
            payload["error"]["message"]
                .as_str()
                .unwrap()
                .contains("names a workspace to write to"),
            "{tool} must refuse on the missing choice, not on a missing folder: {payload}"
        );
        let recovery = payload["error"]["recovery"].as_str().unwrap();
        assert!(
            recovery.contains("init_workspace"),
            "{tool} recovery must name the way out: {recovery}"
        );
    }

    assert!(
        !home.path().join("notes").exists(),
        "the refused writes must not create the user workspace"
    );
    let (listed, _) = c.call("list_workspaces", json!({}));
    assert_eq!(listed["workspaces"].as_array().unwrap().len(), 0);
    assert_eq!(listed["defaultUserWorkspace"]["exists"], false);
}

#[test]
fn reads_in_a_clean_session_still_answer_from_the_user_workspace() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({}));

    for (tool, key) in [("search_memory", "memories"), ("list_tasks", "tasks")] {
        let (payload, is_err) = c.call(tool, json!({}));
        assert!(!is_err, "{tool} must keep working: {payload}");
        assert_eq!(payload["workspace"]["slug"], "notes", "{tool}");
        assert_eq!(payload[key].as_array().unwrap().len(), 0, "{tool}");
    }

    // list_docs already reported the empty folder before this policy; it must
    // still be that answer and not the write refusal.
    let (payload, is_err) = c.call("list_docs", json!({}));
    assert!(is_err, "{payload}");
    assert!(
        payload["error"]["message"]
            .as_str()
            .unwrap()
            .contains("is missing"),
        "reads keep their own error, not the write refusal: {payload}"
    );

    assert!(
        !home.path().join("notes").exists(),
        "a read must not create the user workspace"
    );
}

#[test]
fn an_un_slugged_write_offers_the_picker_and_lands_in_the_picked_workspace() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({"elicitation": {}}));
    init_project(&mut c, home.path(), "chosen");
    // A bare ~/notes folder carries no marker, so it is still a fallback while
    // being a slug the picker can offer.
    std::fs::create_dir_all(home.path().join("notes")).unwrap();

    let mut picker = None;
    let (doc, is_err) = c.call_with(
        "write_doc",
        json!({"title": "Plan", "body": "# Plan", "status": "research"}),
        |msg| {
            assert_eq!(msg["method"], "elicitation/create");
            picker = Some(msg["params"].clone());
            json!({"action": "accept", "content": {"workspace": "chosen"}})
        },
    );
    assert!(!is_err, "{doc}");
    assert_eq!(doc["workspace"]["slug"], "chosen");
    assert_eq!(
        std::fs::read_dir(home.path().join("notes"))
            .unwrap()
            .count(),
        0,
        "nothing may land in the user folder that was not picked"
    );

    let picker = picker.expect("server asked which workspace to write to");
    let field = &picker["requestedSchema"]["properties"]["workspace"];
    assert!(
        field["enum"].as_array().unwrap().contains(&json!("chosen")),
        "{picker}"
    );
    assert!(
        field.get("default").is_none(),
        "the fallback must not be preselected as the answer: {picker}"
    );
}

#[test]
fn declining_the_picker_refuses_the_un_slugged_write_with_the_workspaces_that_exist() {
    let home = temp_home();
    let mut c = McpClient::spawn(home.path(), &[], json!({"elicitation": {}}));
    init_project(&mut c, home.path(), "existing");

    let (payload, is_err) = c.call_with(
        "write_doc",
        json!({"title": "Plan", "body": "# Plan", "status": "research"}),
        |_| json!({"action": "decline"}),
    );
    assert!(is_err, "{payload}");
    assert_eq!(payload["error"]["code"], "workspace_not_found");
    assert!(
        payload["error"]["recovery"]
            .as_str()
            .unwrap()
            .contains("existing"),
        "the refusal must name the workspaces a retry could use: {payload}"
    );
    assert!(!home.path().join("notes").exists());
}
