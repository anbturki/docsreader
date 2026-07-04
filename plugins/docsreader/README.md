# DocsReader plugin for Claude Code

Brings DocsReader task state into the Claude Code terminal:

- **`/docsreader:board`** - print the task board (To Do / In Progress / Done) on demand.
- **`/docsreader:sync`** - pull fresh task state into context before continuing work.
- **Statusline** - a live `To Do / In Progress / Done` count in the status bar.
- **Auto-sync hook** - after a task status changes via the MCP, the assistant is
  handed the updated counts for its next turn.

The plugin bundles the `docsreader` MCP server, so agents can also call
`list_tasks` / `write_task` / `set_task_status` directly.

> Claude Code's native task panel cannot be written to by plugins - it is
> model-driven only. This plugin uses the surfaces that *are* extensible
> (statusline, slash commands, hooks, MCP), so the board is a count bar plus an
> on-demand printout, not an interactive in-terminal kanban.

## Requirements

- **`docsreader-mcp`** on your `PATH`. Installed with DocsReader via the Homebrew
  tap (`brew install anbturki/tap/docsreader`); the binary ships inside the app
  bundle and is linked onto `PATH`.
- **`jq`** - used by the statusline and sync-hook scripts.

## Install

```shell
/plugin marketplace add anbturki/docsreader
/plugin install docsreader@docsreader
```

Or from a local checkout:

```shell
/plugin marketplace add /Users/aliturki/devspace/workspaces/docsreader
/plugin install docsreader@docsreader
```

For development, load without installing:

```shell
claude --plugin-dir /Users/aliturki/devspace/workspaces/docsreader/plugins/docsreader
```

Then `/reload-plugins` to pick up edits.

## Statusline setup (manual, one-time)

The statusline is configured in **your** `settings.json`, not by the plugin, and
installed plugins live in an unstable cache path - so copy the script to a stable
location and point `settings.json` at it:

```shell
cp /Users/aliturki/devspace/workspaces/docsreader/plugins/docsreader/statusline/docsreader-statusline.sh ~/.claude/docsreader-statusline.sh
chmod +x ~/.claude/docsreader-statusline.sh
```

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/docsreader-statusline.sh",
    "refreshInterval": 10,
    "padding": 1
  }
}
```

## Which workspace does it read?

The statusline and sync hook count task files (`tasks/*.md` with a `status:`
frontmatter field) straight from disk. They look, in order, at:

1. `$DOCSREADER_TASKS` (set this to a `tasks/` folder to force a workspace)
2. `./notes/tasks` and `./tasks` relative to the current directory
3. `~/notes/tasks` (the default user workspace)

Set `DOCSREADER_TASKS` when your workspace lives somewhere else.

## Notes

- If you already registered the `docsreader` MCP server through the DocsReader
  GUI (in `~/.claude.json`), this plugin also provides one under the same name.
  Keep whichever you prefer; running both registers the server twice.
- All commands and the statusline are read-only. Task status only changes when an
  agent calls the MCP `set_task_status` tool (or you edit the file).
