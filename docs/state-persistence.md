# State persistence

DocsReader keeps user state in a single Tauri store file (`docsreader.settings.json`, in
the platform's app config dir). This document maps every key the app writes, what
it contains, when it loads, when it saves, and what happens when shape changes.

All persistence goes through `src/lib/storage.ts`.

## Keys

| Key             | Shape                                                                      | Owner                       | Loaded by                              |
| --------------- | -------------------------------------------------------------------------- | --------------------------- | -------------------------------------- |
| `roots`         | `string[]`                                                                 | `useLibrary`                | mount                                  |
| `lastSelected`  | `string`                                                                   | `useLibrary`                | mount                                  |
| `scanCache`     | `Record<rootPath, { result: ScanResult; cachedAt: number }>`               | `useLibrary`                | per-root, on root activation           |
| `viewSettings`  | `ViewSettings` (see below)                                                 | `useViewSettings`           | mount                                  |
| `tabsState`     | `{ paths: string[]; activePath?: string; scrollByPath: Record<string,number> }` | `useTabs`                   | mount                                  |
| `sidebarState`  | `{ open: boolean; expanded: Record<string, boolean> }`                     | `useSidebarState`           | mount                                  |

### `viewSettings`

```ts
{
  width: "narrow" | "full",
  fontFamily: "sans" | "serif" | "mono",
  fontSize: "sm" | "md" | "lg",
  colorScheme: "light" | "dark" | "system",
  accentColor: "violet" | "blue" | "green" | "orange" | "rose" | "slate",
  codeThemeLight: LightCodeTheme,
  codeThemeDark: DarkCodeTheme,
  outlineOpen: boolean,
  quickOpenShortcut: string,  // "Mod+P" format
}
```

### `tabsState`

```ts
{
  paths: string[],                              // open tab paths in order
  activePath?: string,                          // last focused tab
  scrollByPath: Record<string, number>,         // vertical scroll offset per path
}
```

`scrollByPath` is pruned to the current open tabs on every save.

### `sidebarState`

```ts
{
  open: boolean,                                // sidebar visible
  expanded: Record<string, boolean>,            // dir key -> explicit user choice
}
```

`expanded` keys are formatted `${rootPath}::${treeNodePath}` so identically-named
folders in different roots don't collide. A directory whose key is absent from the
map falls back to a depth-based default (open at depth 0, collapsed deeper).
"Collapse All" writes `false` for every visible directory.

## Lifecycle

### Loading

Each owner runs an async `load*()` once on mount, validates shape, and falls back
to defaults on missing or malformed values. While loading is in flight the owner
exposes a `hydrated` boolean so the persist effect skips empty initial state.

### Saving

Each owner schedules a save on a 250ms debounce. Saves are batched: state changes
inside the debounce window collapse to one write. Scroll position changes use a
500ms debounce since they fire on every wheel event.

The Tauri store flushes to disk via `store.save()` after each `set()`.

### Hydration guard

Without a hydration guard the persist effect would fire with the initial empty
state immediately on mount, overwriting saved data before the load resolves.
Every owner does:

```ts
useEffect(() => {
  if (!hydrated) return;
  schedulePersist();
}, [state, hydrated]);
```

## What is *not* persisted (intentional)

- Sidebar **search query** - resets to empty on launch. Persisting it would open
  the app filtered, which masks files the user expects to see.
- Sidebar **active tag** - same reasoning as search.
- Tab **content / frontmatter / loading / error** - re-derived from disk on
  reopen via `loadTab`.
- **Tree expansion defaults** - the depth-based heuristic is the implicit
  default; explicit user overrides are persisted.
- **Settings dialog open state** - transient UI.
- **Quick open dialog open state** - transient UI.
- Mermaid render output, KaTeX output - re-rendered.

## Debugging

To inspect or wipe state, the store file lives at:

- macOS: `~/Library/Application Support/com.docsreader.app/docsreader.settings.json`
- Linux: `~/.config/com.docsreader.app/docsreader.settings.json`
- Windows: `%APPDATA%/com.docsreader.app/docsreader.settings.json`

Deleting the file resets the app to its defaults; deleting an individual top-level
key resets only that subsystem.

## Adding a new persisted field

1. Define the shape in `src/lib/storage.ts` and add `load*` / `save*` helpers
   that validate every field against its expected type and fall back to defaults.
2. Decide which hook owns it (or create a new one). Mirror the pattern in
   `useTabs` / `useSidebarState`: load on mount, set `hydrated`, schedule a
   debounced save when state changes.
3. Add the key to the table above.
4. Decide whether the field should *not* be persisted (transient UI, derived
   data). If so, add it to the "not persisted" list with a one-line reason so
   the next person doesn't waste time looking for it.
