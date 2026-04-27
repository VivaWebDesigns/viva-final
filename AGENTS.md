# Agent Instructions

## Git Workflow

- Before editing, run `git fetch --prune`, then check the current repo, branch, remote, and `git status --short --branch`.
- Work from clean `main` unless the user explicitly asks for another branch.
- If local changes already exist, identify them before editing. Do not mix new work into unrelated changes.
- Stage only files that belong to the user's requested task.
- When the user asks to commit, create a clear, focused commit for the requested task.
- When the user asks to push, push the requested commit to the intended branch, usually `main` when Replit or production sync is expected.
- After committing or pushing, report the commit hash, repository, and branch.
- Do not leave stale task branches, temporary worktrees, unpushed requested commits, or unrelated staged files behind.

## Safety

- Never discard, reset, or delete local work unless the user explicitly approves that exact cleanup.
- If cleanup is needed, preserve recovery points first with a backup branch or named stash.
- Prefer small, scoped changes that follow the existing codebase patterns.
