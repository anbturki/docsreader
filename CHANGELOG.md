# Changelog

All notable changes to DocsReader are recorded here.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and DocsReader adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.10.0] - 2026-07-22

> [!IMPORTANT]
> **Agents: a write with no workspace is now refused instead of falling back to the shared personal workspace.**
> If your agent setup relies on writing without naming a workspace, it will start
> getting an error until a workspace covers the folder it works in. See
> Breaking changes below.

> [!IMPORTANT]
> **macOS 11 Big Sur or later is now required**, with Safari 16.4 or later installed.
> Earlier builds claimed to support macOS 10.15 Catalina, which they never could.
> The in-app updater cannot check the system version, so a Mac below Big Sur will
> still be offered this update and the installed app will not launch. Update macOS first.

### Breaking changes

- **A write with no `workspace` argument is refused unless a workspace covers where the agent is working.**
  Previously such a write fell back to the shared personal workspace at `~/notes`,
  creating it if it did not exist, so project work was silently absorbed into a
  folder nobody chose. Now the write is refused with an error listing the
  workspaces that do exist; clients that support prompting are asked to pick one
  instead. Affects `write_doc`, `update_doc`, `set_status`, `set_phase`, `archive`,
  `rename_doc`, `delete_doc`, `write_task`, `update_task`, `set_task_status` and
  `write_memory`. Passing `workspace` explicitly always works, including when it
  names the personal workspace: that is a choice rather than a drift.
- **Reads are unchanged.** `list_docs`, `read_doc`, `search_docs`, `list_tasks` and
  `search_memory` still fall back to the personal workspace, so a session with
  nothing set up can still look around.
- **Only `init_workspace` creates a workspace.** Create-on-first-write is gone. To
  restore the old behaviour for a project, run `init_workspace` once against that
  project and use the slug it reports.
- **The minimum supported macOS is 11 Big Sur** (previously declared 10.15 Catalina).
  The installer now stops on anything older and warns below macOS 13.3, which is
  the first release that already carries the required Safari; on Big Sur and
  Monterey, update Safari before launching. The Homebrew cask declares the same
  requirement.

### Added

- **Search inside document contents.** The sidebar search now matches the text
  inside documents as well as names, titles and tags. Results are grouped by
  document with a match count each, expand to every matching line in context, and
  collapse individually.
- **One search for the whole sidebar.** A magnifier in the sidebar header reveals
  the search box; the query applies to whichever lens is showing, including Tasks,
  where it matches task titles and ids.
- **Scope filters.** Any search can be narrowed to Files, Contents or Tags, from
  the sidebar and from quick open.
- **Content matches in quick open.** Quick open lists matches from inside
  documents beneath the file-name matches, each with the line that matched, across
  every open workspace. File-name ranking still resolves instantly.
- **Find in the open document.** A find bar scoped to the focused pane highlights
  every match, steps through them with Enter and Shift+Enter, centres the focused
  match and reads a running count. Rendered math is found by its source through
  workspace search rather than in the rendered page.
- **Rebindable search shortcuts.** Quick open, find in document and workspace
  search are all editable in Settings and take effect without a restart. A cleared
  or unusable binding falls back to its default rather than leaving the action
  unreachable.
- **Tasks in the main area.** Tasks open as a full-window tab with room for
  side-by-side status columns, shown as a board or as one flat list, chosen from
  the toolbar while that tab is showing.
- **Collapsible status groups.** Each status folds to its header row, keeping its
  count visible, remembered per workspace. A folded status opens itself while a
  search or filter has a match inside it, and a card can still be dropped onto it.
- **Task filters in the sidebar header.** Priority and label filters live in a
  popover beside search, and the task count moves onto the header row.
- **A sidebar that collapses to its rail.** Collapsing now leaves the lens rail in
  place, so every lens stays one click away; the collapse control lives on the rail
  and keeps one position in both states.
- **A workspace switcher menu.** The switcher is a single control naming the active
  workspace, opening a list of every workspace with add and remove.
- **Four more accent colours** - teal, magenta, bronze and black - and a rebuilt
  appearance picker that shows each scheme as a miniature interface and each accent
  as a labelled chip.

### Changed

- **One toolbar across the window.** The separate document toolbar and sidebar
  header are replaced by a single bar spanning the full window width, holding the
  workspace switcher. Nothing in it moves as you switch tabs: the search sits at
  a fixed point rather than drifting with the length of the path beside it or
  with a control appearing for the open tab.
- **Lenses moved to a vertical rail** down the left edge, each an icon with its
  name, so adding lenses no longer reflows the sidebar. The sidebar is wider to
  pay for it, leaving the content column wider than the whole sidebar used to be.
- **The panels are inset as a set**, the document card trades its shadow for a
  hairline border and a smaller corner radius, and the rail carries the chosen
  accent as a solid fill that reads the same in light and dark.
- **The sidebar header is a row of controls** - search, filter, refresh and any
  count the lens publishes - with no title of its own. The footer file count is
  gone; the link back to hidden files stays.
- **Refresh moved from the window toolbar into the sidebar header**, and one
  control now both rescans the workspace and reloads whatever the lens is showing.
- **The editor follows the app theme.** Editing surfaces take their colours from
  the same theme and accent as the reader, instead of a pasted-in palette that
  tracked neither, so greys, the caret and inline code stop changing between
  reading and editing.
- **Status colours come from the theme.** Git badges, the external-change banner
  and its tab dot, diff rows and the up-to-date line all draw from the theme's
  palette rather than their own hard-coded shades. Their hues stay independent of
  the accent on purpose, so a green accent cannot turn a removed diff line green.
- **Slate reads as a slate.** It was drawn at full saturation on a blue hue, which
  made it a second Blue in the picker. Every other stored accent choice renders
  exactly as before.
- **The document explorer is hidden beside a full-window task board**, which is
  already a view of the whole workspace. The sidebar toggle still works, and an
  ordinary document still opens with the sidebar the way it was left.
- **Agent guidance for choosing a workspace.** The onboarding resource and the tool
  descriptions now set out list, reuse, create as the order, ask for a name that
  identifies the project rather than "Notes" or "Docs", state that a git repository
  is a valid location and that only the notes folder is written, and say that an
  already-a-workspace answer means the workspace is ready to use.
- **`init_workspace` reports the slug it assigned.** A slug that another workspace
  already holds is refused, naming the folder it collides with; a slug derived from
  a folder name gets a suffix instead. Use the returned value on later calls.
- **Workspace listing reflects what is on disk.** Each workspace's slug is read
  from its own folder, so editing it takes effect, and workspaces whose folder no
  longer exists are dropped from the list instead of being offered.
- **Remembered tabs use a new stored shape.** Upgrading keeps your open tabs.
  Downgrading does not: a build older than 0.10.0 reads the new store as empty and
  starts with no tabs.

### Removed

- **Create-on-first-write.** A write no longer creates the workspace it lands in;
  see Breaking changes above.
- The file count in the sidebar footer, and the separate free-text filter on the
  task board, which the one sidebar search now covers.

### Fixed

- The window's close, minimise and zoom controls were drawn for the wrong
  appearance when the chosen theme differed from the system one, leaving them
  invisible against the toolbar until hovered.
- Choosing a light or dark theme no longer gets overridden when the system
  switches its own appearance, so the app stops turning dark at sunset.
- The whole window could scroll behind the app: a long document grew the page
  instead of scrolling inside its pane, producing a second scrollbar and carrying
  the tab bar off the top of the window.
- Primary buttons had no hover state anywhere in the app.
- A task card could not be dragged onto another status on macOS: the drag started
  and ended but no column ever saw it.
- Dialogs and sheets did not dim the page behind them, so the content behind
  competed with the dialog in front.
- Scroll position stopped being remembered in a pane that opened with its document
  already loaded, which is what toggling the split does. The same fault dropped the
  reader back at a stale position each time an agent rewrote the open file.
- A tab could sit on Loading forever when a read settled at exactly the wrong
  moment.
- Opening a file that had been deleted showed a raw filesystem error, absolute path
  and error number included, instead of saying the file is gone and pointing at
  refreshing the workspace.
- Switching between two already-open tabs re-parsed and re-rendered every open
  document, so the switch was visibly slow and the outgoing document lingered.
- A stray vertical scrollbar painted over the tab titles, and in a split view sat
  on top of the active tab's name.
- Two workspaces could carry the same slug, and every call naming it went to
  whichever registered first, so work landed in the wrong folder and reported
  success. An ambiguous slug is now reported rather than guessed.
- Every unnamed workspace showed as "notes" in the switcher, because managed
  workspaces all live in a folder of that name. They are now labelled by the
  project that contains them.

[Unreleased]: https://github.com/anbturki/docsreader/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/anbturki/docsreader/compare/v0.9.2...v0.10.0
