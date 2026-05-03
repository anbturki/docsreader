# Roadmap

DocsReader is in active development. This document tracks what's coming, what's being considered, and what just shipped.

Layout uses **Now / Next / Later / Considering** - no fixed dates, no quarter commitments. Items move between sections as scope and priorities shift. Want to influence direction? [Open an issue](https://github.com/anbturki/docsreader/issues/new).

## Now

In active development.

_(nothing actively in flight after v0.2.0 - on deck, picking from "Next")_

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
- **Side-by-side view** - split panes for comparing two docs or following inline links.
- **Local "smart" features** - related-docs ("you may also want…") via TF-IDF, extractive TL;DR via TextRank. AI-feeling, no AI service.
- **Drag-to-update task status** - requires DocsReader to write user files (currently read-only). Trust shift.

## Recently shipped

### v0.2.0
- Quick Open (Cmd+P, configurable shortcut) jumps to any file across all roots.
- Outline / TOC sidebar with active-heading scroll-spy.
- LaTeX math via KaTeX. Mermaid diagrams (lazy-loaded; theme-aware).
- Configurable code-block themes (light + dark, 12 themes).
- Sidebar collapse state, open tabs, active tab, and per-tab scroll position survive restarts.
- Strict CSP, sanitized markdown HTML, scheme-allowlisted links.
- Async-then-staple release pipeline - CI no longer blocks for hours waiting on Apple notarization.
- README badge tracking pending notarization.

### v0.1.x
- Multi-root file scanning, tabs, file watcher, light/dark themes, accent colors, frontmatter parsing, code-signed + notarized macOS bundles, Homebrew tap, signed auto-updates.

---

[Open an issue](https://github.com/anbturki/docsreader/issues/new) to comment, suggest, or vote.
