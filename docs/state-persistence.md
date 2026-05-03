# State persistence notes

User state lives in a Tauri store at `docsreader.settings.json` in the platform's
app config dir. The schema and lifecycle are visible in `src/lib/storage.ts` and
the four hooks that own state (`useLibrary`, `useViewSettings`, `useTabs`,
`useSidebarState`). This file captures the things you *can't* derive from the
code.

## What is NOT persisted (and why)

Don't re-add these without first revisiting the reasoning - each was a
deliberate call:

- **Sidebar search query and active tag.** Re-loading the app filtered hides
  files the user expects to see.
- **Settings dialog / quick-open dialog open state.** Transient UI, never useful
  to restore.
- **Tab content / frontmatter / loading / error.** Re-derived from disk on
  reopen via `loadTab`.
- **Tree expansion defaults.** Depth-based heuristic is the implicit default;
  explicit user toggles are persisted.
- **Mermaid renders, KaTeX output.** Cheap to regenerate.

## Store file location

For debugging or wiping state:

- macOS: `~/Library/Application Support/com.docsreader.app/docsreader.settings.json`
- Linux: `~/.config/com.docsreader.app/docsreader.settings.json`
- Windows: `%APPDATA%/com.docsreader.app/docsreader.settings.json`

Delete the file to reset all state; delete a single top-level key to reset only
that subsystem.

## Adding a new persisted field

1. Add `load*` / `save*` helpers in `storage.ts` that validate every field and
   fall back to defaults on missing or malformed values.
2. Mirror the pattern in `useTabs` / `useSidebarState`: load on mount, set a
   `hydrated` flag, schedule a debounced save when state changes.
3. **Hydration guard is non-negotiable.** Without `if (!hydrated) return;` in
   the persist effect, the initial empty state overwrites saved data on first
   render before the load resolves.
4. If the field is intentionally *not* persisted (transient UI, derived data),
   add it to the "not persisted" list above with a one-line reason.
