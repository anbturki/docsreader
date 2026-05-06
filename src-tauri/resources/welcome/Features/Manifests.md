# Curated nav with `.docs.yaml`

If your project's docs folder ships a `.docs.yaml` at the root, DocsReader uses it to drive the file tree, the workspace label, and which files are hidden. The result is a curated reading order instead of an alphabetical scan.

This welcome workspace itself uses one - look at the sidebar. Sections like **Start here** and **Features** are declared in `.docs.yaml`, not derived from folder names.

## A minimal manifest

```yaml
spec_version: "0.1"

project:
  slug: my-project
  name: My Project
  tagline: One-line description

navigation:
  - title: Start here
    items:
      - title: Architecture
        path: docs/architecture.md
      - title: Operating contract
        path: docs/CONTRACT.md

  - title: Decisions
    folder: docs/adr/
    sort: filename
    title_from: heading

ignore:
  - docs/archived/**
  - "**/*.draft.md"
```

Drop that in your repo root and DocsReader picks it up on the next scan.

## What it controls

- `project.name` becomes the workspace tab label.
- `project.homepage` opens automatically when you first add the workspace.
- `navigation` becomes the sidebar tree (`items` for hand-curated lists, `folder` for auto-listed sections).
- `ignore` adds glob patterns to your clutter rules for that workspace only.

DocsReader implements the `.docs.yaml` v0.1 spec. Any project that ships a compliant manifest gets a curated experience for free.
