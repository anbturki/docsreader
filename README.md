<img src="docs/logo.png" width="96" align="right" alt="DocsReader logo" />

# DocsReader

The human window into an agent-managed markdown corpus. Your AI agents write docs, memory, and tasks through the bundled MCP server; you read the same plain markdown files in a clean native app. And it still works as a fast reader for any folder of markdown - macOS, Linux, Windows.

[![Latest Release](https://img.shields.io/github/v/release/anbturki/docsreader?label=latest&color=7c3aed)](https://github.com/anbturki/docsreader/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/anbturki/docsreader/total?color=7c3aed)](https://github.com/anbturki/docsreader/releases)
[![Notarization](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/anbturki/docsreader/main/.github/badges/notarization.json)](https://github.com/anbturki/docsreader/actions/workflows/notarize-staple.yml)
[![Apple Notarized](https://img.shields.io/badge/macOS-signed%20%26%20notarized-000000?logo=apple&logoColor=white)](https://github.com/anbturki/docsreader/actions/workflows/notarize-staple.yml)

[![Download for macOS](https://img.shields.io/badge/macOS-Download-000000?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/anbturki/docsreader/releases/latest/download/DocsReader_0.7.0_universal.dmg)
[![Download for Windows](https://img.shields.io/badge/Windows-Download-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/anbturki/docsreader/releases/latest/download/DocsReader_0.7.0_x64-setup.exe)
[![Download for Linux](https://img.shields.io/badge/Linux-Download-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/anbturki/docsreader/releases/latest/download/DocsReader_0.7.0_amd64.AppImage)

Linux: AppImage works on most distros - for `.deb` (Debian/Ubuntu) or `.rpm` (Fedora/RHEL), see [Releases](https://github.com/anbturki/docsreader/releases/latest).

Or install via [Homebrew or one-liner](#install).

![DocsReader](docs/screenshots/main.png)

## How it works

Everything is plain markdown on disk - no database, no lock-in, greppable, and versionable with git. Agents are the primary writers; DocsReader is where you watch the corpus grow, and open docs reload live as agents write.

A **workspace** is a folder of markdown. Your default one lives at `~/notes` (created on first write); any project can opt in to its own `<project>/notes`. Three namespaces live inside:

- **Docs** hold the substance: research, plans, decisions. Each doc sits in the folder matching its lifecycle status - `research/`, `in-progress/`, `done/`, `archived/` - so the folder IS the status, and moving the file IS the status change. Optional phase subfolders (`research/v2-launch/`) group work inside a status.
- **Memory** (`memory/`) holds short topic-addressed facts ("user prefers tabs", "we deploy to staging"). One entry per topic; writing a topic again replaces it wholesale.
- **Tasks** (`tasks/`) are [Backlog.md](https://github.com/MrLesk/Backlog.md)-shaped files: `task-N` ids, status in frontmatter, an acceptance-criteria checklist agents tick as they go.

The MCP server exposes tools for all of it (`write_doc`, `search_docs`, `set_status`, `write_memory`, `write_task`, ...), a `docsreader://onboarding` resource that teaches agents the model, and every doc as a readable MCP resource. Tool errors carry recovery hints, so agents self-correct instead of stalling.

## Connect your AI agents

In DocsReader: **Settings → AI agents → Connect**. The app detects installed clients (Claude Code, Cursor, Windsurf, VS Code, Codex) and registers the bundled `docsreader-mcp` server with each - one click, user-wide.

To register manually, point any stdio-capable MCP client at the binary:

| Install | Binary location |
| --- | --- |
| Homebrew (macOS) | `docsreader-mcp` (on PATH) |
| DMG (macOS) | `/Applications/DocsReader.app/Contents/MacOS/docsreader-mcp` |
| deb (Linux) | `/usr/bin/docsreader-mcp` (on PATH) |
| Windows | `docsreader-mcp.exe` next to `DocsReader.exe` in the install folder |

`docsreader-mcp` is a local stdio server - there is no URL to add; each client spawns the binary itself. With Claude Code:

```sh
claude mcp add --scope user docsreader -- docsreader-mcp
```

Codex CLI:

```sh
codex mcp add docsreader -- docsreader-mcp
```

VS Code:

```sh
code --add-mcp '{"name":"docsreader","command":"docsreader-mcp"}'
```

Cursor (`~/.cursor/mcp.json`) and Windsurf (`~/.codeium/windsurf/mcp_config.json`):

```json
{ "mcpServers": { "docsreader": { "command": "docsreader-mcp" } } }
```

If `docsreader-mcp` is not on your PATH (macOS DMG install without Homebrew), use the full binary path from the table above instead. Homebrew users who installed before v0.6.0 and auto-updated in-app: run `brew upgrade --cask docsreader` once so Homebrew links the binary - the in-app updater cannot do that. The in-app Connect flow always writes the full path, so it works regardless.

Then tell your agents how to use it: copy the [AGENTS template](docs/AGENTS-TEMPLATE.md) into your repo's `AGENTS.md` or `CLAUDE.md`.

## Claude Code plugin

If you use Claude Code, the bundled plugin surfaces DocsReader tasks right in the terminal. Add this repo as a plugin marketplace, then install:

```shell
/plugin marketplace add anbturki/docsreader
/plugin install docsreader@docsreader
```

What you get:

- **`/docsreader:board`** - print the To Do / In Progress / Done board on demand
- **`/docsreader:sync`** - pull fresh task state into context before continuing
- **Statusline** - a live task-count bar (`To Do / In Progress / Done`), one-time setup
- **Auto-sync hook** - after a task status changes via the MCP, the assistant gets the updated counts on its next turn

It registers the same `docsreader-mcp` server (so agents can call `list_tasks` / `write_task` / `set_task_status`), so it needs `docsreader-mcp` on your PATH (installed with the app or Homebrew) and `jq`. Full setup - the statusline config and which workspace it reads - is in the [plugin README](plugins/docsreader/README.md).

## Features

- **Rich rendering** - GitHub-flavored Markdown, KaTeX math, Mermaid diagrams, and Shiki code highlighting across twelve themes
- **Interactive checklists** - toggle any checkbox from the rendered view; the change writes back to the file
- **Five lenses** - Tree, Recent, Tags, Pinned, and a Tasks kanban board over one library
- **Split view** - two docs side-by-side or stacked, each with its own tabs and scroll
- **Task board** - To Do / In Progress / Done with drag-to-advance and acceptance-criteria progress, consistent with the MCP
- **Agent-aware** - open docs reload live as agents write; on-disk changes surface a diff; git status shows in the tree
- **Quiet and local** - minimal chrome, no telemetry, signed updates, notarized on macOS

See the [full feature list](docs/FEATURES.md) for everything.

Found a bug, want a feature, or have feedback? [Open an issue](https://github.com/anbturki/docsreader/issues/new) - I'm actively building this and feedback shapes the roadmap.

## What's new in v0.7.0

- **Task board.** A Tasks lens with a To Do / In Progress / Done kanban, drag-to-advance that writes status through the same core agents use, and filters by title, priority, and label.
- **Task headers.** Docs the MCP wrote as tasks render a status pill, priority, assignee, and an acceptance-criteria progress bar.
- **Interactive checklists.** Toggle any task-list checkbox from the rendered view; the change writes back to the file and moves a task's progress with it.
- **Refreshed UI.** An integrated overlay toolbar, a draggable window, and the design tokens applied across the settings dialog and the board.
- **Claude Code plugin.** Board and sync skills, a live task statusline, and a task-sync hook.

Full history on the [releases page](https://github.com/anbturki/docsreader/releases).

## Screenshots

| | |
| --- | --- |
| ![Tree lens: status folders and phase subfolders](docs/screenshots/tree.png) | ![Light theme](docs/screenshots/light-theme.png) |
| ![Split view, dark](docs/screenshots/split-dark.png) | ![Split view, stacked (dark)](docs/screenshots/horizontal-split.png) |
| ![Settings](docs/screenshots/settings.png) | ![Search](docs/screenshots/search.png) |
| ![Context menu](docs/screenshots/context-menu.png) | ![Quick Open (Cmd+P)](docs/screenshots/quick-open.png) |
| ![Images](docs/screenshots/images.png) | ![Recognized task header with acceptance-criteria progress](docs/screenshots/tasks-header.png) |
| ![Tasks lens: a card in To Do](docs/screenshots/tasks-board.png) | ![Drag-to-advance: card moved to In Progress, status written back to the file](docs/screenshots/tasks-drag-after.png) |
| ![A file changed on disk: reload, keep, or view the diff](docs/screenshots/external-change.png) | ![Side-by-side diff with word-level highlighting](docs/screenshots/diff.png) |

## Install

### macOS (Homebrew)

```sh
brew install --cask anbturki/tap/docsreader
```

### macOS / Linux (curl)

```sh
curl -fsSL https://raw.githubusercontent.com/anbturki/docsreader/main/install.sh | bash
```

### Manual

From [Releases](https://github.com/anbturki/docsreader/releases/latest):

| OS | File |
| --- | --- |
| macOS (Intel + Apple Silicon) | `DocsReader_*_universal.dmg` |
| Linux | `DocsReader_*_amd64.AppImage` or `.deb` |
| Windows | `DocsReader_*_x64-setup.exe` |

## Security

See [SECURITY.md](./SECURITY.md).

---

## Development

Built with [Tauri 2](https://tauri.app/), React, and Rust. Requires [Bun](https://bun.sh/), [Rust](https://rustup.rs/), and the [Tauri 2 system deps](https://tauri.app/start/prerequisites/) for your OS.

```sh
bun install
bun run tauri dev
```

The MCP server is a separate tauri-free binary in the same cargo workspace:

```sh
cargo build --manifest-path src-tauri/Cargo.toml -p docsreader-mcp
```

### Releasing

GitHub → Actions → **Cut Release** → enter the version (e.g. `0.1.2`). The workflow bumps `tauri.conf.json` + `Cargo.toml` + `Cargo.lock`, commits, tags, and triggers the release pipeline (signs, notarizes the macOS bundle, drafts a GitHub Release, updates the Homebrew tap).
