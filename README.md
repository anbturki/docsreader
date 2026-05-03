# DocsReader

Point it at any folder. DocsReader scans the directory for Markdown files, organizes them into a navigable tree, and renders each one in a clean reader. macOS, Linux, Windows.

[![Latest Release](https://img.shields.io/github/v/release/anbturki/docsreader?label=latest&color=7c3aed)](https://github.com/anbturki/docsreader/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/anbturki/docsreader/total?label=downloads&color=7c3aed)](https://github.com/anbturki/docsreader/releases)

[![Download for macOS](https://img.shields.io/badge/macOS-Download-000000?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/anbturki/docsreader/releases/latest)
[![Download for Windows](https://img.shields.io/badge/Windows-Download-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/anbturki/docsreader/releases/latest)
[![Download for Linux](https://img.shields.io/badge/Linux-Download-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/anbturki/docsreader/releases/latest)

Or install via [Homebrew or one-liner](#install).

![DocsReader](docs/screenshots/main.png)

## Features

- Scan any folder of Markdown, with live reload as files change
- Light + dark themes, 6 accent colors
- Search files, titles, and tags
- Reading preferences - font, size, page width
- Right-click context menu - copy path, reveal in Finder
- YAML frontmatter parsed for titles and tags
- Signed auto-updates
- Code-signed and notarized on macOS

Found a bug, want a feature, or have feedback? [Open an issue](https://github.com/anbturki/docsreader/issues/new) - I'm actively building this and feedback shapes the roadmap.

## Screenshots

| | |
|---|---|
| ![Light theme](docs/screenshots/light-theme.png) | ![Settings](docs/screenshots/settings.png) |
| ![Search](docs/screenshots/search.png) | ![Context menu](docs/screenshots/context-menu.png) |

## Install

### macOS (Homebrew)

```sh
brew install --cask anbturki/tap/docsreader
```

### macOS / Linux (curl)

```sh
curl -fsSL https://raw.githubusercontent.com/anbturki/docsreader/main/install.sh | bash
```

### Manual

From [Releases](https://github.com/anbturki/docsreader/releases/latest):

| OS | File |
|---|---|
| macOS (Intel + Apple Silicon) | `DocsReader_*_universal.dmg` |
| Linux | `docsreader_*_amd64.AppImage` or `.deb` |
| Windows | `DocsReader_*_x64-setup.exe` |

## Security

See [SECURITY.md](./SECURITY.md).

---

## Development

Built with [Tauri 2](https://tauri.app/), React, and Rust. Requires [Bun](https://bun.sh/), [Rust](https://rustup.rs/), and the [Tauri 2 system deps](https://tauri.app/start/prerequisites/) for your OS.

```sh
bun install
bun run tauri dev
```

### Releasing

GitHub → Actions → **Cut Release** → enter the version (e.g. `0.1.2`). The workflow bumps `tauri.conf.json` + `Cargo.toml` + `Cargo.lock`, commits, tags, and triggers the release pipeline (signs, notarizes the macOS bundle, drafts a GitHub Release, updates the Homebrew tap).
