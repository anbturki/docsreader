# DocsReader

A fast, native desktop reader for Markdown documentation. Point it at a folder, get an organized, browseable view of every `.md` file with live reload, syntax highlighting, and reading-style controls.

Built with [Tauri 2](https://tauri.app/), React, and Rust. Available for macOS, Linux, and Windows.

## Features

- **Read any folder of Markdown** - point at a directory, get a navigable tree of every `.md` file
- **Live reload** - edits on disk show up immediately in the viewer
- **Reading preferences** - font family (sans/serif/mono), font size, narrow vs full-width pages
- **Compact folder tree** - VS Code-style chains for deeply nested docs without horizontal scroll
- **Native performance** - directory scanning runs in Rust with parallel walkers, not the WebView
- **Frontmatter aware** - YAML frontmatter (titles, tags) parsed and used for sorting/labels
- **Auto-update** - signed updates delivered through the in-app updater
- **Code-signed and notarized** on macOS

## Install

### macOS - Homebrew (recommended)

```sh
brew install --cask anbturki/tap/docsreader
```

### macOS / Linux - one-line install

```sh
curl -fsSL https://raw.githubusercontent.com/anbturki/docsreader/main/install.sh | bash
```

### Manual

Grab the appropriate file from [Releases](https://github.com/anbturki/docsreader/releases/latest):

| OS | File |
|---|---|
| macOS (Intel + Apple Silicon) | `DocsReader_*_universal.dmg` |
| Linux | `docsreader_*_amd64.AppImage` or `.deb` |
| Windows | `DocsReader_*_x64-setup.exe` |

## Development

Requires [Bun](https://bun.sh/), [Rust](https://rustup.rs/), and the Tauri 2 system dependencies for your platform ([macOS](https://tauri.app/start/prerequisites/#macos), [Linux](https://tauri.app/start/prerequisites/#linux), [Windows](https://tauri.app/start/prerequisites/#windows)).

```sh
bun install
bun run tauri dev
```

To build a local production binary:

```sh
bun run tauri build
```

## Project layout

```
src/                    React frontend (TypeScript + Vite)
  components/             UI components (sidebar, viewer, settings)
  lib/                    Scan, tree builder, persistence helpers
src-tauri/              Rust backend
  src/lib.rs              scan_markdown command (walkdir + rayon)
  capabilities/           Tauri permission scopes
  tauri.conf.json         Bundle, signing, and updater config
.github/workflows/      CI: release builds + CodeQL scanning
install.sh              Curl-pipe-bash installer
```

## Releasing

Releases are cut by pushing a tag. The workflow builds for all three platforms, signs and notarizes the macOS bundle, publishes a draft GitHub Release, and updates the Homebrew tap.

```sh
# bump src-tauri/tauri.conf.json "version"
git tag v0.2.0
git push origin v0.2.0
# then publish the draft at https://github.com/anbturki/docsreader/releases
```

## Security

See [SECURITY.md](./SECURITY.md) for how to report vulnerabilities.
