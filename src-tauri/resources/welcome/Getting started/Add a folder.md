# Add a folder

Click the **+** in the workspace switcher (top of the sidebar) and pick any folder of markdown. DocsReader scans for `.md`, `.markdown`, and `.mdx` files - up to 50,000 per workspace.

You can have as many workspaces as you like. Each one is independent: own scan, own pinned files, own clutter rules. Click any tab in the switcher to jump between them.

## What gets scanned

- All markdown files anywhere in the folder, recursively.
- Files larger than 4 MB are skipped (probably not docs).
- Hidden folders (`.git`, `node_modules`, build artifacts, etc.) are skipped automatically.
- Symlinks are not followed - DocsReader stays inside the folder you picked.

## Removing a workspace

Right-click any workspace tab and choose **Remove workspace**. Your files are untouched - DocsReader only forgets where to look.
