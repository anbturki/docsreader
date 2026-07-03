<img src="docs/logo.png" width="96" align="right" alt="DocsReader logo" />

# DocsReader

The human window into an agent-managed markdown corpus. Your AI agents write docs, memory, and tasks through the bundled MCP server; you read the same plain markdown files in a clean native app. And it still works as a fast reader for any folder of markdown - macOS, Linux, Windows.

[![Latest Release](https://img.shields.io/github/v/release/anbturki/docsreader?label=latest&color=7c3aed)](https://github.com/anbturki/docsreader/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/anbturki/docsreader/total?color=7c3aed)](https://github.com/anbturki/docsreader/releases)
[![Notarization](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/anbturki/docsreader/main/.github/badges/notarization.json)](https://github.com/anbturki/docsreader/actions/workflows/notarize-staple.yml)
[![Apple Notarized](https://img.shields.io/badge/macOS-signed%20%26%20notarized-000000?logo=apple&logoColor=white)](https://github.com/anbturki/docsreader/actions/workflows/notarize-staple.yml)

[![Download for macOS](https://img.shields.io/badge/macOS-Download-000000?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/anbturki/docsreader/releases/latest/download/DocsReader_0.6.1_universal.dmg)
[![Download for Windows](https://img.shields.io/badge/Windows-Download-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/anbturki/docsreader/releases/latest/download/DocsReader_0.6.1_x64-setup.exe)
[![Download for Linux](https://img.shields.io/badge/Linux-Download-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/anbturki/docsreader/releases/latest/download/DocsReader_0.6.1_amd64.AppImage)

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

## Features

**Reading**

- **Rendering:** GitHub-flavored Markdown via remark-gfm (tables, task lists, footnotes, autolinks, strikethrough)
- **Math expressions:** LaTeX rendered inline and in blocks via KaTeX
- **Diagrams:** Mermaid renderer (lazy-loaded, follows theme)
- **Box-drawing art:** svgbob converts ASCII diagrams to SVG (experimental)
- **Code blocks:** 20 bundled language grammars via Shiki, twelve highlighter palettes (5 light, 7 dark)
- **Appearance:** light, dark, or follow-system, with six accent hues
- **Type controls:** font family, body size, and reading column width
- **Quick edit:** a pencil on any open doc flips to the raw markdown for fast human fixes; agents stay the primary writers

**Browsing**

- **Workspaces:** keep multiple unrelated folders open and pivot between them
- **Lenses:** four browsing modes over the same library (Tree, Recent, Tags, Pinned)
- **Jump-to-file:** fuzzy finder across every workspace, opens with Cmd+P (binding configurable)
- **Document outline:** auto-built TOC that follows the active heading as you scroll
- **Backlinks:** the sidebar lists every doc that links to the one you are reading, grouped by folder
- **Tabs:** many docs open at once; scroll position remembered per tab
- **Split view:** read two docs side-by-side or stacked; each pane keeps its own tabs, scroll, and external-change banner. Toggle from the header, drag the splitter to resize, or use Cmd+\ (horizontal), Cmd+Shift+\ (vertical), Cmd+1 / Cmd+2 to focus a pane. "Open in other pane" lives in the file context menu.
- **Search:** filename, path, frontmatter title, or tag
- **Sticky favorites:** pin individual files to the top of any workspace
- **Clutter rules:** glob patterns silently exclude files and folders from the explorer

**Agent-aware**

- **Managed workspaces:** a folder with a `.docsreader.yaml` marker gets its display name in the switcher, its homepage opened on first add, and agent writes reloading open docs silently
- **Convert prompt:** opening a plain folder offers to make it a managed workspace; declining keeps it read-only forever
- **External changes surfaced:** in unmanaged folders, when a file you have open changes on disk (other editor, sync service, AI agent), a banner shows what changed with reload / keep / show-diff actions
- **Git status decorations:** in a git repo, the file tree shows per-file status badges (M / A / D / R / ? / U) that refresh as files change
- **Git diff vs HEAD:** right-click any tracked file to see the diff between HEAD and your working tree, with unified or side-by-side views and word-level highlighting

**Quiet by default**

- **Minimal chrome:** flat active states, no badges, only user-initiated motion (ADHD-friendly, low visual load)
- **One thing at a time:** lenses replace the tree instead of stacking on top of it
- **Same place, every launch:** controls do not migrate around the window
- **Resumes where you left off:** tabs, scroll, sidebar, and active lens persist across sessions

**Trust**

- **Stays local:** no telemetry, no sync; the only outbound request is the updater check
- **Signed updates:** every release artifact ships with a minisign signature; the updater verifies before applying
- **Gatekeeper-friendly:** code-signed and Apple-notarized on macOS
- **Hardened renderer:** strict CSP, sanitized HTML, scheme-allowlisted links

Found a bug, want a feature, or have feedback? [Open an issue](https://github.com/anbturki/docsreader/issues/new) - I'm actively building this and feedback shapes the roadmap.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full picture. Short version:

- **Next:** find-in-page, full-text search, focus mode.
- **Later:** PDF export, kanban view over task files, drag-a-folder-to-add-root, file management.
- **Considering:** plugin API, annotations, drag tabs between panes / N-pane nesting, local "smart" features (related-docs, TL;DR).

## Screenshots

| | |
| --- | --- |
| ![Light theme](docs/screenshots/light-theme.png) | ![Split view, dark](docs/screenshots/split-dark.png) |
| ![Split view, stacked (dark)](docs/screenshots/horizontal-split.png) | ![Settings](docs/screenshots/settings.png) |
| ![Search](docs/screenshots/search.png) | ![Context menu](docs/screenshots/context-menu.png) |
| ![Quick Open (Cmd+P)](docs/screenshots/quick-open.png) | ![Images](docs/screenshots/images.png) |

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
