#!/usr/bin/env bash
# PostToolUse hook for mcp__docsreader__set_task_status.
# Re-counts task statuses on disk and injects a fresh board summary as context
# so the assistant's next turn reflects the change it just made.
set -euo pipefail

input="$(cat)"

# The MCP hook payload shape for a tool result is not guaranteed to expose the
# task path at a fixed key, so search the whole JSON for a "*/tasks/*" path and
# use its directory. Fall back to the session cwd if none is found.
task_path="$(printf '%s' "$input" \
  | jq -r '[.. | strings | select(test("/tasks/[^/]+\\.md$"))] | first // empty' 2>/dev/null || true)"

tasks_dir=""
if [ -n "$task_path" ]; then
  tasks_dir="$(dirname "$task_path")"
fi

if [ -z "$tasks_dir" ] || [ ! -d "$tasks_dir" ]; then
  cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)"
  for cand in "$cwd/notes/tasks" "$cwd/tasks" "$HOME/notes/tasks"; do
    if [ -d "$cand" ]; then tasks_dir="$cand"; break; fi
  done
fi

[ -n "$tasks_dir" ] && [ -d "$tasks_dir" ] || exit 0

count() {
  grep -rlE "^status:[[:space:]]*['\"]?$1['\"]?[[:space:]]*$" "$tasks_dir" 2>/dev/null \
    | wc -l | tr -d ' '
}
todo="$(count 'To Do')"
prog="$(count 'In Progress')"
done="$(count 'Done')"

jq -n --arg ctx "DocsReader board now: ${todo} To Do, ${prog} In Progress, ${done} Done." \
  '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
