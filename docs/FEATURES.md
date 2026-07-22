# Features

The full feature list for DocsReader. The [README](../README.md#features) shows the highlights; this is everything.

## Reading

- **Rendering:** GitHub-flavored Markdown via remark-gfm (tables, task lists, footnotes, autolinks, strikethrough)
- **Interactive checklists:** click any task-list checkbox in a rendered doc to toggle it - the change writes straight back to the markdown file, and a task's acceptance-criteria progress moves with it, no switching to edit mode
- **Math expressions:** LaTeX rendered inline and in blocks via KaTeX. Formulas are searchable by their LaTeX source (workspace search reads the markdown), not by their rendered glyphs
- **Diagrams:** Mermaid renderer (lazy-loaded, follows theme)
- **Box-drawing art:** svgbob converts ASCII diagrams to SVG (experimental)
- **Code blocks:** 20 bundled language grammars via Shiki, twelve highlighter palettes (5 light, 7 dark)
- **Appearance:** light, dark, or follow-system, with six accent hues
- **Type controls:** font family, body size, and reading column width
- **WYSIWYG edit:** a pencil on any open doc opens an in-place editor with a slash menu, block drag handles, a selection toolbar, and live tables - edit the doc as it reads, not raw markdown; agents stay the primary writers. Frontmatter is preserved untouched, an unchanged doc is never rewritten, and a save is refused if an agent changed the file on disk while you were editing

![A rendered doc with a Mermaid diagram, highlighted code, and a clickable checklist](screenshots/main.png)

## Browsing

- **Workspaces:** keep multiple unrelated folders open and pivot between them from the switcher at the left of the toolbar, which also adds and removes them
- **Open with:** double-click a `.md`/`.markdown`/`.mdx` in Finder, or right-click > Open With DocsReader. A folder opens as a workspace; a file resolves to its workspace (or its parent folder) and opens in the active pane, whether the app was already running or launched by the open
- **Lenses:** five browsing modes over the same library (Tree, Recent, Tags, Pinned, Tasks), picked from a vertical rail that gives each one an icon and its name. Collapsing the sidebar leaves the rail in place, so the lenses stay one click away
- **Jump-to-file:** fuzzy finder across every workspace, opens with Cmd+P (binding configurable)
- **Document outline:** auto-built TOC that follows the active heading as you scroll
- **Backlinks:** the outline panel lists every doc that links to the one you are reading, grouped by folder
- **Tabs:** many docs open at once; scroll position remembered per tab
- **Split view:** read two docs side-by-side or stacked; each pane keeps its own tabs, scroll, and external-change banner. Toggle from the toolbar, drag the splitter to resize, or use Cmd+\ (horizontal), Cmd+Shift+\ (vertical), Cmd+1 / Cmd+2 to focus a pane. "Open in other pane" lives in the file context menu.
- **Search:** three ways in, each rebindable in Settings
  - **Jump to a file** (⌘P): every open workspace at once. Ranks file names first, then lists matches found inside documents with the line that matched
  - **Search the workspace** (⇧⌘F): a magnifier in the sidebar header reveals the search box and its filters. Results are grouped by document with a match count each, and expand to show every matching line in context. The query applies to whichever lens is showing, including Tasks
  - **Find in the open document** (⌘F): highlights every match, with next/previous and a running count
- **Source or page:** workspace search and ⌘P read the markdown, so LaTeX is found there. ⌘F reads the rendered page, so it skips rendered math, whose glyphs are positioned by CSS rather than in reading order
- **Narrow a search:** ⌘P and the workspace search can be limited to Files, Contents, or Tags; on the Tasks lens the query matches task titles and ids instead
- **Sticky favorites:** pin individual files from the tree or any list; each workspace keeps its own set, gathered in the Pinned lens
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
- **Tasks board:** a lens stacking tasks under a To Do, In Progress, or Done group; cards show priority, assignee, and progress, and open the underlying file on click
- **Drag-to-advance:** drag a card to another group to change its status; the write goes through the same core the agents use, so a GUI move and an MCP `set_task_status` stay consistent
- **Collapsible groups:** fold a status group away by its heading; the choice is remembered per workspace, and a folded group reopens on its own while a search or filter has matches in it
- **Board filters:** the sidebar search matches task titles and ids, and the filter control beside it holds priority and label in a popover; filters compose

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
