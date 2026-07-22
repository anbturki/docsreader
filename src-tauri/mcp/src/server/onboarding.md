# DocsReader agent onboarding

DocsReader is a local markdown store you write to over MCP while humans read the
same files in the DocsReader app. Prefer these tools over raw file writes: they
handle slugs, frontmatter, collisions, lifecycle moves, and git staging. Staging
runs only when the workspace folder sits inside a git repository, and it only
adds the file just written: never a commit, never anything outside the
workspace folder.

## Model

- A workspace is a folder of markdown docs. Default user workspace: `~/notes`
  (created by `init_workspace`, never by a write). A project workspace is
  `<project>/notes`; when one exists it takes precedence. See "Choosing a
  workspace".
- Docs live in the folder matching their lifecycle status:
  `research/`, `in-progress/`, `done/`, `archived/`. The folder IS the status.
- Optional phase subfolders group work inside a status, e.g.
  `research/v2-launch/plan.md`. The folder IS the phase.
- Filenames are slugs generated from titles. Frontmatter carries title, tags,
  owner, created_at, created_by - never status or phase.

## Choosing a workspace

Each project gets its own workspace. Labels and tags group work inside one
workspace; they do not separate projects, and `list_tasks` in a shared
workspace returns other projects' tasks too.

List first, reuse second, create last: `list_workspaces` before writing, and
if one already belongs to this project, use it. `init_workspace` answering
"already a DocsReader workspace" means the same thing - that workspace is
ready, keep writing there rather than looking for somewhere else.

When asked to track work for a project that has no workspace yet, take the
first option that fits and proceed without asking:

1. `init_workspace {path: "<project root>", name: "<the project or product>"}`,
   creating `<project>/notes`. The project root being a git repository is not
   a blocker: only the `notes` folder is written, and files there are staged
   but never committed.
2. If the project's own tree must stay untouched, use a sibling folder:
   `init_workspace {path: "<parent>/<project>-notes"}`. Pass that workspace's
   slug on every later call, since it is outside the project tree and will not
   be picked up automatically.
3. `~/notes` only for work that belongs to no project. Do not park a new
   project's docs or tasks there.

A write with no `workspace` argument is refused when nothing here resolves to
a workspace, rather than falling back to `~/notes`; the refusal lists the
workspaces that do exist. Reads still fall back, so they never need setup.

The `name` is what humans pick from in the app, so it must identify the
project or product: `"Acme Billing API"`, never `"Notes"` or `"Docs"`. Leave
`slug` to its default (the project folder name) unless `list_workspaces`
already shows that slug in use.

## Workflow

1. `list_workspaces` shows what exists; `init_workspace` creates one.
2. `write_doc {title, body, status}` creates a doc and returns its URI.
3. `list_docs` / `search_docs` find docs; results are ranked and budgeted.
4. `read_doc {path}` reads one: concise (snippet) by default, `detailed` for
   the full body.
5. `update_doc {path, old_str, new_str}` edits in place by exact string
   replacement; `old_str` must appear exactly once.
6. `set_status` / `set_phase` / `archive` move docs through the lifecycle.
   The move is the status change; nothing else to update.

## Memory

- Short, topic-addressed facts live in `memory/` ("user prefers tabs",
  "project uses Better Auth"), outside the doc lifecycle: no status, no phase.
- `write_memory {topic, content}` creates or overwrites the entry for that
  topic wholesale, so include everything still worth remembering.
- `search_memory {query}` returns matching entries with their full content;
  omit the query to list all. Check memory before re-deriving facts.
- Remove stale entries with `delete_doc {path: "memory/<slug>.md"}`.
- Long-form knowledge belongs in docs; promote a grown memory with
  `write_doc`, then delete the entry.

## Tasks

- Work items live in `tasks/` as Backlog.md-shaped files: `task-N` ids,
  status in frontmatter ("To Do" | "In Progress" | "Done"), a Description
  section, and an Acceptance Criteria checklist.
- `write_task {title, description, acceptance_criteria?}` creates one;
  `list_tasks {status?}` shows the board; `set_task_status {id, status}`
  moves it.
- `update_task {id, old_str, new_str}` edits in place: check a criterion by
  replacing `- [ ] #1 ...` with `- [x] #1 ...`, or append notes.
- Unlike docs, tasks never move between folders; status is frontmatter-only.

## Conventions

- Address docs by slug (`api-notes`) or status-relative path
  (`research/api-notes.md`).
- Tool failures return `{error: {code, message, recovery}}`; follow the
  recovery hint - it names valid values, available slugs, or the doc's new
  location when it moved.
- Every doc is also an MCP resource: `docsreader://{workspace}/{path}`.
- Write docs for future readers (humans and agents): a clear title, a short
  opening summary, and tags make `search_docs` work well.
