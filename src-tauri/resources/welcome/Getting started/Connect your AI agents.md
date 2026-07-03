# Connect your AI agents

DocsReader ships with `docsreader-mcp`, a local MCP server your AI agents write through: docs, memory, and tasks, all as plain markdown files you read here. Connect it once and agents like Claude Code, Cursor, Windsurf, VS Code, and Codex can record research, decisions, and progress while you watch the corpus grow live.

## One click

Open **Settings -> AI agents**. DocsReader detects the agent tools installed on this machine and shows a **Connect** button for each - one click registers the server, user-wide. Already-connected tools show a check mark.

## Manual setup

`docsreader-mcp` is a local stdio server - there is no URL to add; each agent spawns the binary itself. With Homebrew (macOS) or the Linux deb it is already on your PATH:

```sh
# Claude Code
claude mcp add --scope user docsreader -- docsreader-mcp

# Codex CLI
codex mcp add docsreader -- docsreader-mcp

# VS Code
code --add-mcp '{"name":"docsreader","command":"docsreader-mcp"}'
```

Cursor (`~/.cursor/mcp.json`) and Windsurf (`~/.codeium/windsurf/mcp_config.json`) take the same JSON shape:

```json
{ "mcpServers": { "docsreader": { "command": "docsreader-mcp" } } }
```

Installed from the macOS DMG without Homebrew? Use the full path instead: `/Applications/DocsReader.app/Contents/MacOS/docsreader-mcp`.

Installed with Homebrew before v0.6.0 and let the app update itself? Homebrew only links `docsreader-mcp` onto your PATH when the cask itself upgrades - run `brew upgrade --cask docsreader` once, or just use the one-click Connect above (it always writes the full path).

## What agents do with it

- **Docs** land in folders that mirror their lifecycle - `research/`, `in-progress/`, `done/`, `archived/`. The folder is the status; moving the file is the status change.
- **Memory** (`memory/`) holds short topic-addressed facts. Writing a topic again replaces it.
- **Tasks** (`tasks/`) are checklist files agents tick off as they work.

By default everything goes to `~/notes` (created on the first write); any project can opt in to its own workspace. The server teaches agents this model itself - after connecting, just ask your agent to "record what you learned in DocsReader".

To make agents use it consistently in a repo, copy the [AGENTS template](https://github.com/anbturki/docsreader/blob/main/docs/AGENTS-TEMPLATE.md) into your `AGENTS.md` or `CLAUDE.md`.
