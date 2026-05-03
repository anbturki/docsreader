# DocsReader

A desktop reader for Markdown documentation. macOS, Linux, Windows.

Built with [Tauri 2](https://tauri.app/), React, and Rust.

![DocsReader](docs/screenshots/main.png)

## Features

- Read any folder of Markdown, with live reload on file changes
- Light + dark themes, 6 accent colors ([screenshot](docs/screenshots/light-theme.png))
- Search files, titles, and tags ([screenshot](docs/screenshots/search.png))
- Reading preferences - font, size, page width ([screenshot](docs/screenshots/settings.png))
- Right-click context menu - copy path, reveal in Finder ([screenshot](docs/screenshots/context-menu.png))
- YAML frontmatter parsed for titles and tags
- Signed auto-updates
- Code-signed and notarized on macOS

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

## Development

Requires [Bun](https://bun.sh/), [Rust](https://rustup.rs/), and the [Tauri 2 system deps](https://tauri.app/start/prerequisites/) for your OS.

```sh
bun install
bun run tauri dev
```

## Releasing

Push a tag. CI builds, signs, notarizes (macOS), drafts a release, and updates the Homebrew tap.

```sh
# bump src-tauri/tauri.conf.json + src-tauri/Cargo.toml "version"
git tag v0.2.0
git push origin v0.2.0
```

## Security

See [SECURITY.md](./SECURITY.md).
