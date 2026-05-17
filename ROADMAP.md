# Roadmap

DocsReader is in active development. This document tracks what's coming, what's being considered, and what just shipped.

Layout uses **Now / Next / Later / Considering** - no fixed dates, no quarter commitments. Items move between sections as scope and priorities shift. Want to influence direction? [Open an issue](https://github.com/anbturki/docsreader/issues/new).

## Now

In active development.

_(picking from "Next" - v0.4 candidate features merged to main; see "Unreleased" below)_

## Next

Committed and scoped, not yet started.

### Reading experience
- **Find in page** (Cmd+F) - search within the open document, jump between matches with Enter / Shift+Enter.
- **Full-text search across docs** - go beyond filename matching. Index document bodies on scan; rank with BM25.
- **Focus / reading mode** - hide sidebar, max width, distraction-free.

### Markdown task formats
A universal reader for the emerging "markdown-as-PM" conventions used by AI coding agents. Parser registry under the hood; ships with built-in parsers for the most common conventions, with room to add more later.

Built-in parsers in v1:
- **Generic frontmatter** - any file with `status:` + checkbox progress.
- **[Backlog.md](https://github.com/MrLesk/Backlog.md)** - markdown-native task manager for Claude Code, Codex, Gemini CLI, etc.
- **[taskmd](https://medium.com/@driangle/taskmd-task-management-for-the-ai-era-92d8b476e24e)** - local-first markdown tasks for AI coding agents.
- **[Obsidian TaskNotes](https://www.obsidianstats.com/plugins/tasknotes)** - one markdown file per task with YAML frontmatter.

**Phase 1 (read-only recognition):** status pill, priority, owner, due, and a progress bar in the document header for any recognized task file.

## Later

Committed direction, not scoped yet.

### Reading
- Print / Export to PDF
- Image lightbox with zoom
- Recently-viewed list (per session and persistent)
- Open-in-external-editor button (VS Code, Cursor, Vim)

### Tasks view
- Kanban-style sidebar mode grouping recognized task files by normalized status.
- Tag / owner / priority filters.
- Click a card → open the file as a tab.
- Live updates as files change (file watcher already in place).

### File management
- Drag a folder into the window to add it as a root.
- Rename / delete / create files from the sidebar context menu.

## Considering

Direction unclear, community input wanted before committing.

- **Plugin API** - expose the parser registry as a community-extensible plugin system once usage justifies the API stability commitment. Obsidian-style if it earns it.
- **Annotations** - highlights and notes that travel with the document. Would shift DocsReader from a reader to a research tool, meaningful identity change.
- **Drag tabs between panes / N-pane nesting** - extend the v0.5 split view to support dragging a tab from one pane to the other, plus arbitrary nesting beyond two panes. Deferred until the 2-pane MVP has real usage feedback.
- **Local "smart" features** - related-docs ("you may also want…") via TF-IDF, extractive TL;DR via TextRank. AI-feeling, no AI service.
- **Drag-to-update task status** - requires DocsReader to write user files (currently read-only). Trust shift.

## Recently shipped

### Unreleased (in main since v0.4.0)
- **Split view** - side-by-side or stacked panes for reading two docs at once. Toggle from the header (single / horizontal / vertical), drag the splitter to resize, "Open in other pane" context-menu entry. Each pane keeps its own tabs, scroll, and external-change banner; the outline tracks whichever pane is focused. Keyboard shortcuts: `Cmd+\` toggles horizontal, `Cmd+Shift+\` toggles vertical, `Cmd+1` / `Cmd+2` focus pane 0 / pane 1. Pane 1's tabs persist across single/split toggles so re-splitting brings them back exactly as they were.

### v0.4.0
- **`.docs.yaml` v0.1 manifest support** - projects shipping a manifest get curated navigation (hand-curated `items` and auto-listed `folder` sections with sort, title-from, badges, nesting), project metadata in the workspace switcher, automatic homepage open on first add, cross-project links between open workspaces, ignore patterns, a visibility toggle for previewing public-only views, and a sidebar pane that surfaces manifest issues.
- **Git integration (T1+T2)** - per-file status badges in the file tree (M / A / D / R / ? / U) for workspaces inside a git repo; "Show git diff" context menu opens a diff vs HEAD with unified or side-by-side view and word-level highlighting. Git binary auto-discovered across PATH plus common Homebrew locations.
- **External-change banner** - when a file open in a tab changes on disk, a banner shows what changed with reload / show-diff / dismiss / always-auto-reload actions; same diff dialog as the git diff feature.
- **Welcome workspace** - first-run installs auto-extract a small bundled tour (uses `.docs.yaml` itself) so empty-state users have something to read.
- **Manifest in-place edit detection** - editing `.docs.yaml` triggers a rescan even though the file set is unchanged.

### v0.3.0
- Workspace-level filesystem watcher: edit / add / remove / rename anywhere in a workspace and the file tree updates without manual refresh.
- Rate-limited watcher: events filtered against a skip list (mirrors the scanner's), 600ms debounce, 2-second minimum interval between rescans regardless of churn.
- Async-then-staple release pipeline: ship the build immediately, swap in the stapled DMG once Apple's notary returns. CI no longer blocks for hours.
- README rewrite around four feature groups (Reading / Browsing / Quiet by default / Trust); right-aligned header logo.

### v0.2.0
- Quick Open (Cmd+P, configurable shortcut) jumps to any file across all roots.
- Outline / TOC sidebar with active-heading scroll-spy.
- LaTeX math via KaTeX. Mermaid diagrams (lazy-loaded; theme-aware).
- Configurable code-block themes (light + dark, 12 themes).
- Sidebar collapse state, open tabs, active tab, and per-tab scroll position survive restarts.
- Strict CSP, sanitized markdown HTML, scheme-allowlisted links.
- README badge tracking pending notarization.

### v0.1.x
- Multi-root file scanning, tabs, file watcher, light/dark themes, accent colors, frontmatter parsing, code-signed + notarized macOS bundles, Homebrew tap, signed auto-updates.

---

[Open an issue](https://github.com/anbturki/docsreader/issues/new) to comment, suggest, or vote.
