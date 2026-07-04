---
description: Refresh DocsReader task state - re-read the tasks so the assistant has the current board in context before continuing work.
---

Call the `docsreader` MCP server's `list_tasks` tool for the active workspace.

Report the current counts (To Do / In Progress / Done) and name any task whose
status looks newly changed. The purpose is to pull fresh task state into context
so subsequent work reflects the latest board. Read-only - do not modify tasks.
