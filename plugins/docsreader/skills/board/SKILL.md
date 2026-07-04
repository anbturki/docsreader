---
description: Show the DocsReader task board grouped by status (To Do / In Progress / Done), with priority, assignee, and acceptance-criteria progress. Read-only.
---

Call the `docsreader` MCP server's `list_tasks` tool for the active workspace.

If the user passed a status argument (for example `/docsreader:board In Progress`),
pass it as the `status` filter to `list_tasks`. If they passed a label, pass it
as the `label` filter.

Print a compact board with three columns in this order: **To Do**, **In Progress**,
**Done**. Under each column, list its tasks sorted by id. For each task show:

- id and title
- priority, when set
- assignee, when set
- acceptance-criteria progress as `done/total` when the task body has an
  `AC:BEGIN..AC:END` block

Do not create, edit, move, or delete any task. This command only reads.
