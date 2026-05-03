#!/usr/bin/env bash
set -euo pipefail

# DocsReader installer
# Usage: curl -fsSL https://raw.githubusercontent.com/anbturki/docsreader/main/install.sh | bash

REPO="anbturki/docsreader"
APP_NAME="DocsReader"

err() { printf "\033[31merror:\033[0m %s\n" "$*" >&2; exit 1; }
info() { printf "\033[34m::\033[0m %s\n" "$*"; }

command -v curl >/dev/null 2>&1 || err "curl is required"

OS="$(uname -s)"
ARCH="$(uname -m)"

info "detecting platform: ${OS}/${ARCH}"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64|aarch64) PATTERN="aarch64.*\.dmg$" ;;
      x86_64) PATTERN="x64.*\.dmg$" ;;
      *) err "unsupported macOS arch: $ARCH" ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      x86_64) PATTERN="amd64.*\.AppImage$" ;;
      *) err "unsupported Linux arch: $ARCH" ;;
    esac
    ;;
  *)
    err "unsupported OS: $OS — try the GitHub Releases page directly"
    ;;
esac

info "fetching latest release info from GitHub"
RELEASE_JSON="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"

ASSET_URL="$(printf "%s" "$RELEASE_JSON" \
  | grep -Eo '"browser_download_url": *"[^"]+"' \
  | grep -E "$PATTERN" \
  | head -n 1 \
  | sed -E 's/.*"(https[^"]+)".*/\1/')"

[ -n "$ASSET_URL" ] || err "no matching asset for ${OS}/${ARCH}"

info "downloading ${ASSET_URL##*/}"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
ASSET="${TMPDIR}/${ASSET_URL##*/}"
curl -fL --progress-bar -o "$ASSET" "$ASSET_URL"

case "$ASSET" in
  *.dmg)
    info "mounting DMG"
    MOUNT_POINT="$(hdiutil attach -nobrowse -readonly "$ASSET" | tail -1 | awk '{ for (i=3; i<=NF; i++) printf "%s%s", $i, (i==NF?"":" ") }')"
    APP_SOURCE="$(find "$MOUNT_POINT" -maxdepth 2 -name "*.app" -print -quit)"
    [ -n "$APP_SOURCE" ] || { hdiutil detach -quiet "$MOUNT_POINT"; err "no .app found in DMG"; }
    info "copying ${APP_SOURCE##*/} to /Applications (sudo may prompt)"
    sudo rm -rf "/Applications/${APP_SOURCE##*/}"
    sudo cp -R "$APP_SOURCE" /Applications/
    hdiutil detach -quiet "$MOUNT_POINT"
    info "installed to /Applications/${APP_SOURCE##*/}"
    ;;
  *.AppImage)
    DEST="${HOME}/.local/bin/${APP_NAME}.AppImage"
    mkdir -p "${HOME}/.local/bin"
    cp "$ASSET" "$DEST"
    chmod +x "$DEST"
    info "installed to $DEST"
    info "ensure ~/.local/bin is on your PATH"
    ;;
  *)
    err "unrecognized asset format: $ASSET"
    ;;
esac

info "done — open '${APP_NAME}' to launch"
