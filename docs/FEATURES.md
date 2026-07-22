# Features

The full feature list for DocsReader. The [README](../README.md#features) shows the highlights; this is everything.

## Reading

- **Rendering:** GitHub-flavored Markdown via remark-gfm (tables, task lists, footnotes, autolinks, strikethrough)
- **Interactive checklists:** click any task-list checkbox in a rendered doc to toggle it - the change writes straight back to the markdown file, and a task's acceptance-criteria progress moves with it, no switching to edit mode
- **Math expressions:** LaTeX rendered inline and in blocks via KaTeX
- **Diagrams:** Mermaid renderer (lazy-loaded, follows theme)
- **Box-drawing art:** svgbob converts ASCII diagrams to SVG (experimental)
- **Code blocks:** 20 bundled language grammars via Shiki, twelve highlighter palettes (5 light, 7 dark)
- **Appearance:** light, dark, or follow-system, with six accent hues
- **Type controls:** font family, body size, and reading column width
- **WYSIWYG edit:** a pencil on any open doc opens an in-place editor with a slash menu, block drag handles, a selection toolbar, and live tables - edit the doc as it reads, not raw markdown; agents stay the primary writers. Frontmatter is preserved untouched, an unchanged doc is never rewritten, and a save is refused if an agent changed the file on disk while you were editing

![A rendered doc with a Mermaid diagram, highlighted code, and a clickable checklist](screenshots/main.png)

## Browsing

- **Workspaces:** keep multiple unrelated folders open and pivot between them
- **Open with:** double-click a `.md`/`.markdown`/`.mdx` in Finder, or right-click > Open With DocsReader. A folder opens as a workspace; a file resolves to its workspace (or its parent folder) and opens in the active pane, whether the app was already running or launched by the open
- **Lenses:** five browsing modes over the same library (Tree, Recent, Tags, Pinned, Tasks)
- **Jump-to-file:** fuzzy finder across every workspace, opens with Cmd+P (binding configurable)
- **Document outline:** auto-built TOC that follows the active heading as you scroll
- **Backlinks:** the sidebar lists every doc that links to the one you are reading, grouped by folder
- **Tabs:** many docs open at once; scroll position remembered per tab
- **Split view:** read two docs side-by-side or stacked; each pane keeps its own tabs, scroll, and external-change banner. Toggle from the header, drag the splitter to resize, or use Cmd+\ (horizontal), Cmd+Shift+\ (vertical), Cmd+1 / Cmd+2 to focus a pane. "Open in other pane" lives in the file context menu.
- **Search:** filename, path, frontmatter title, tag, or the text inside the documents themselves. Results are ranked and show the matching line in context
- **Find in document:** Cmd+F highlights every match in the open doc, with next/previous and a running count
- **Sticky favorites:** pin individual files to the top of any workspace
- **Clutter rules:** glob patterns silently exclude files and folders from the explorer

![Split view: two docs side by side, each with its own tab bar](screenshots/split-dark.png)

## Agent-aware

- **Managed workspaces:** a folder with a `.docsreader.yaml` marker gets its display name in the switcher, its homepage opened on first add, and agent writes reloading open docs silently
- **Convert prompt:** opening a plain folder offers to make it a managed workspace; declining keeps it read-only forever
- **External changes surfaced:** in unmanaged folders, when a file you have open changes on disk (other editor, sync service, AI agent), a banner shows what changed with reload / keep / show-diff actions
- **Git status decorations:** in a git repo, the file tree shows per-file status badges (M / A / D / R / ? / U) that refresh as files change
- **Git diff vs HEAD:** right-click any tracked file to see the diff between HEAD and your working tree, with unified or side-by-side views and word-level highlighting

![A file changed on disk, shown as a side-by-side diff with word-level highlighting](screenshots/diff.png)

## Tasks

- **Task header:** a doc the MCP wrote as a task (Backlog.md-shaped frontmatter) renders a header - status pill, priority, assignee, and an acceptance-criteria progress bar - instead of plain markdown
- **Tasks board:** a kanban lens grouping tasks into To Do / In Progress / Done columns; cards show priority, assignee, and progress, and open the underlying file on click
- **Drag-to-advance:** drag a card to another column to change its status; the write goes through the same core the agents use, so a GUI move and an MCP `set_task_status` stay consistent
- **Board filters:** narrow by free-text title, priority, or label; filters compose

![The Tasks board beside a task doc with its status pill and acceptance-criteria progress](screenshots/tasks-header.png)

## Quiet by default

- **Minimal chrome:** flat active states, no badges, only user-initiated motion (ADHD-friendly, low visual load)
- **One thing at a time:** lenses replace the tree instead of stacking on top of it
- **Same place, every launch:** controls do not migrate around the window
- **Resumes where you left off:** tabs, scroll, sidebar, and active lens persist across sessions

## Trust

- **Stays local:** no telemetry, no sync; the only outbound request is the updater check
- **Signed updates:** every release artifact ships with a minisign signature; the updater verifies before applying
- **Gatekeeper-friendly:** code-signed and Apple-notarized on macOS
- **Hardened renderer:** strict CSP, sanitized HTML, scheme-allowlisted links
