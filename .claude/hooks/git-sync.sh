#!/bin/sh
# Session-start sync: fast-forward main from origin when it is safe to do so.
# Never merges, rebases, or touches local changes; reports why it skipped instead.
# Used by the Claude Code SessionStart hook and by AGENTS.md for Codex.

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

branch=$(git branch --show-current)
if [ "$branch" != "main" ]; then
  echo "git-sync: on branch '$branch', not main; skipped auto-pull."
  exit 0
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "git-sync: uncommitted changes on main; skipped auto-pull. Identify these changes before editing."
  exit 0
fi

before=$(git rev-parse HEAD)
if ! out=$(GIT_TERMINAL_PROMPT=0 git pull --ff-only -q 2>&1); then
  echo "git-sync: pull failed (offline, auth, or main has diverged from origin). Resolve before editing:"
  echo "$out" | head -5
  exit 0
fi
after=$(git rev-parse HEAD)

if [ "$before" = "$after" ]; then
  echo "git-sync: main is up to date with origin."
  exit 0
fi

count=$(git rev-list --count "$before..$after")
echo "git-sync: fast-forwarded main by $count commit(s) ($(git rev-parse --short "$before")..$(git rev-parse --short "$after"))."
changed=$(git diff --name-only "$before" "$after")
if echo "$changed" | grep -qE '^package(-lock)?\.json$'; then
  echo "git-sync: package.json/package-lock.json changed; run npm install."
fi
if echo "$changed" | grep -qE '^(shared/schema|drizzle\.config)'; then
  echo "git-sync: database schema files changed; do not push the schema without asking."
fi
exit 0
