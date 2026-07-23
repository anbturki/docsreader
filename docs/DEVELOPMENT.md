# Development

Built with [Tauri 2](https://tauri.app/), React, and Rust. Requires [Bun](https://bun.sh/), [Rust](https://rustup.rs/), and the [Tauri 2 system deps](https://tauri.app/start/prerequisites/).

```sh
bun install
bun run tauri dev
```

The MCP server is a separate tauri-free binary in the same cargo workspace:

```sh
cargo build --manifest-path src-tauri/Cargo.toml -p docsreader-mcp
```

## Releasing

GitHub → Actions → **Cut Release** → enter the version. The workflow bumps `tauri.conf.json` + both `Cargo.toml`s + `Cargo.lock` + the README download URLs, commits, tags, and triggers the release pipeline (signs, notarizes the macOS bundle, drafts a GitHub Release, updates the Homebrew tap).
