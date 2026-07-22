# MCP tools

DocsReader ships a local stdio MCP server, `docsreader-mcp`, that your AI agents drive. Connect it once and agents call the tools below directly.

## Connect

In DocsReader, **Settings → AI agents → Connect** detects installed clients and registers `docsreader-mcp` with each in one click, user-wide. To register manually, point any stdio MCP client at the binary - there is no URL, each client spawns it:

| Client | Command |
| --- | --- |
| Claude Code | `claude mcp add --scope user docsreader -- docsreader-mcp` |
| Codex CLI | `codex mcp add docsreader -- docsreader-mcp` |
| VS Code | `code --add-mcp '{"name":"docsreader","command":"docsreader-mcp"}'` |
| Cursor / Windsurf | add `{ "docsreader": { "command": "docsreader-mcp" } }` under `mcpServers` in the client's MCP config |

If `docsreader-mcp` is not on your PATH, use the full binary path instead:

| Install | Binary location |
| --- | --- |
| Homebrew (macOS) | `docsreader-mcp` (on PATH) |
| DMG (macOS) | `/Applications/DocsReader.app/Contents/MacOS/docsreader-mcp` |
| deb (Linux) | `/usr/bin/docsreader-mcp` (on PATH) |
| Windows | `docsreader-mcp.exe` next to `DocsReader.exe` |

Homebrew users from before v0.6.0: run `brew upgrade --cask docsreader` once so the binary links onto PATH. Then copy the [AGENTS template](AGENTS-TEMPLATE.md) into your repo's `AGENTS.md` or `CLAUDE.md`.

## Tools

Every tool takes an optional `workspace` slug. Omit it and the server resolves one from where the agent is working: a project `./notes` if there is one above it, else your `~/notes`. Reads resolve that way always, so a session that has no workspace of its own can still look around.

Writes do not fall back. A write with no `workspace` argument is refused unless a workspace actually covers where the agent is working: a project `./notes` above it, or `~/notes` when that is where the agent is standing. Working from an unrelated folder is refused even when `~/notes` exists, because filing project work in the shared folder is the mistake this prevents. Clients that can put a question to you are offered a pick from the workspaces that exist; when the client cannot be asked, the refusal lists them and points at `init_workspace`. Only `init_workspace` creates a workspace. An explicit `workspace` slug is always honoured, including `notes`: naming it is a choice, and only an unnamed write can drift.

Tool errors carry recovery hints, so agents self-correct instead of stalling.

Give each project its own workspace: labels group work inside a workspace, they do not separate projects. List first, reuse second, create last - `list_workspaces` before writing, and an "already a DocsReader workspace" answer from `init_workspace` means that workspace is ready, not that you should write elsewhere. In order of preference, an agent starting on a project with no workspace should `init_workspace {path: "<project root>", name: "<the project or product>"}` (a git repository is fine - only the `notes` folder is written, and files there are staged, never committed); failing that, use a sibling folder such as `<parent>/<project>-notes` and pass its slug explicitly; `~/notes` is for work that belongs to no project. The `name` is what the app's switcher lists, so it must identify the project or product (`"Acme Billing API"`, not `"Notes"`).

### Workspaces

| Tool | What it does |
| --- | --- |
| `list_workspaces` | List all known workspaces: registered projects plus the default `~/notes`. Call before choosing where to write. |
| `init_workspace` | Create and register a workspace (`~/notes`, or `<path>/notes` for a project). The only tool that creates one: no write will conjure a workspace for you. Fails if `<path>/notes` already holds files, or if an explicit `slug` already belongs to another workspace. An omitted slug is derived from the folder name, suffixed when that name is taken, and returned as `slug`. |
| `ping` | Health check; returns `pong`. |

### Docs

| Tool | What it does |
| --- | --- |
| `write_doc` | Create a doc in the folder matching its status (`research` / `in-progress` / `done` / `archived`), with generated frontmatter. Handles slugs, collisions, and git staging (adds the file, never commits). |
| `read_doc` | Read a doc by slug or status-relative path. Concise (frontmatter + snippet) by default, or `detailed` for the full body. |
| `list_docs` | List docs newest first; filter by status, phase, or tag (filters AND together). |
| `search_docs` | Rank matches across title, tags, slug, and content; returns snippets and `docsreader://` resource URIs. |
| `update_doc` | Edit in place by exact string replacement; `old_str` must appear exactly once. |
| `set_status` | Move a doc between `research` / `in-progress` / `done` / `archived`. The move IS the status change; phase is preserved. |
| `set_phase` | Move a doc into a phase subfolder within its status, or out of it when phase is omitted. |
| `archive` | Shorthand for `set_status(path, "archived")`. |
| `rename_doc` | Change the title; becomes the new frontmatter title and slug/filename. Stays in its status and phase. |
| `delete_doc` | Permanently delete a doc (or a memory/task by its path). Outside git history this cannot be undone; prefer `archive`. |

### Memory

| Tool | What it does |
| --- | --- |
| `write_memory` | Save a topic-addressed fact. One entry per topic: writing the same topic overwrites its content wholesale. |
| `search_memory` | Recall memories, ranked over topic, tags, and content, each with full content. Omit the query to list every entry newest first. |

### Tasks

| Tool | What it does |
| --- | --- |
| `write_task` | Create a [Backlog.md](https://github.com/MrLesk/Backlog.md)-shaped task: `task-N` id, frontmatter status, a Description and an Acceptance Criteria checklist. |
| `list_tasks` | List tasks ordered by id; filter by status (`To Do` / `In Progress` / `Done`) or label. |
| `set_task_status` | Move a task between `To Do` / `In Progress` / `Done` by rewriting its frontmatter. |
| `update_task` | Edit a task by string replacement, e.g. tick a criterion by replacing `- [ ] #1 ...` with `- [x] #1 ...`, or append notes. |

## Resources

Beyond tools, the server exposes read-only MCP resources:

- **`docsreader://onboarding`** - teaches an agent the workspace model (docs / memory / tasks, statuses, phases) on connect.
- **`docsreader://<workspace>/<path>`** - every doc, memory entry, and task as a readable resource. `list_docs` and `search_docs` return these URIs.

## A typical flow

```jsonc
list_workspaces {}                         // pick where to write; init_workspace if there is nowhere yet
write_doc     { "title": "Use Postgres", "status": "done", "body": "..." }
write_task    { "title": "Add connection pooling",
                "description": "...",
                "acceptance_criteria": ["Bounded pool", "Clean 503 on timeout"] }
update_task   { "id": "task-1", "old_str": "- [ ] #1", "new_str": "- [x] #1" }
set_task_status { "id": "task-1", "status": "Done" }
search_memory { "query": "deploy process" }   // check before re-deriving facts
```
