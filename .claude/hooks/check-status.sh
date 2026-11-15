#!/usr/bin/env bash
# Blocks stopping once if code changed but STATUS.md was not updated in this working tree.
input=$(cat)
if echo "$input" | grep -q '"stop_hook_active":[[:space:]]*true'; then exit 0; fi
cd "$CLAUDE_PROJECT_DIR" || exit 0
changed=$(git status --porcelain 2>/dev/null | awk '{print $2}')
[ -z "$changed" ] && exit 0
if echo "$changed" | grep -qvE '^docs/' && ! echo "$changed" | grep -q '^docs/STATUS.md$'; then
  echo "Code changed but docs/STATUS.md was not updated. Update it (or run /wrap-up) before stopping." >&2
  exit 2
fi
exit 0
