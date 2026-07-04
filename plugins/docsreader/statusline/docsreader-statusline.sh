#!/usr/bin/env bash
# Claude Code statusline: DocsReader task counts read straight from disk.
# Configure in settings.json (see the plugin README). Re-runs on refreshInterval.
set -euo pipefail

input="$(cat)"
model="$(printf '%s' "$input" | jq -r '.model.display_name // "Claude"' 2>/dev/null || echo "Claude")"
cwd="$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // empty' 2>/dev/null || true)"

# DOCSREADER_TASKS overrides workspace discovery; otherwise probe the usual spots.
tasks_dir="${DOCSREADER_TASKS:-}"
if [ -z "$tasks_dir" ] || [ ! -d "$tasks_dir" ]; then
  for cand in "$cwd/notes/tasks" "$cwd/tasks" "$HOME/notes/tasks"; do
    if [ -d "$cand" ]; then tasks_dir="$cand"; break; fi
  done
fi

if [ -z "$tasks_dir" ] || [ ! -d "$tasks_dir" ]; then
  printf '%s | DocsReader: no workspace' "$model"
  exit 0
fi

count() {
  grep -rlE "^status:[[:space:]]*['\"]?$1['\"]?[[:space:]]*$" "$tasks_dir" 2>/dev/null \
    | wc -l | tr -d ' '
}
printf '%s | DocsReader: %s To Do - %s In Progress - %s Done' \
  "$model" "$(count 'To Do')" "$(count 'In Progress')" "$(count 'Done')"
