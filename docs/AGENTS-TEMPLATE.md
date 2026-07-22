# AGENTS template for DocsReader

Copy the section below into your repo's `AGENTS.md` or `CLAUDE.md` so agents
keep docs, memory, and tasks in the project's DocsReader workspace. Replace
`my-project` with a slug for your repo (the folder name works). It assumes
the `docsreader` MCP server is registered (DocsReader: Settings → AI agents
→ Connect).

---

## Docs, memory, and tasks (DocsReader)

This project keeps its knowledge in a DocsReader workspace at `./notes`
(workspace slug: `my-project`), served by the `docsreader` MCP server. Use
its tools instead of writing markdown files by hand: they handle slugs,
frontmatter, status folders, and git staging (files under `./notes` are added
to the index, never committed, and nothing else in the repo is touched).

- Pass `workspace: "my-project"` on every docsreader call so nothing lands
  in the wrong workspace. If a call fails with `workspace_not_found`, create
  the workspace once with `init_workspace {path: "<absolute repo root>",
  slug: "my-project"}` and retry. This repo being a git repository is not a
  reason to write elsewhere.
- Never track this project's docs or tasks in `~/notes` or another project's
  workspace; a label is not a substitute for a workspace.
- Read the `docsreader://onboarding` resource once per session for the full
  model.
- Before writing anything, search: `search_memory {query}` for prior facts,
  `search_docs {query}` for prior docs. Supersede instead of duplicating.
- Record durable findings, designs, and decisions as docs:
  `write_doc {title, body, status}` with status `research`, `in-progress`,
  `done`, or `archived`. Move them later with `set_status` / `archive`.
- Save short facts worth keeping across sessions with
  `write_memory {topic, content}`. One entry per topic; a rewrite replaces
  the entry wholesale, so include everything still true.
- Track multi-step work with `write_task {title, description,
  acceptance_criteria}`; move it with `set_task_status {id, status}` and tick
  criteria via `update_task` by replacing `- [ ] #1 ...` with `- [x] #1 ...`.
- When a tool call fails, follow the `recovery` field in the error - it names
  valid values, available workspaces, or where a doc moved.
