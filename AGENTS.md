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

## Database Schema Changes

- This project deploys on Railway. Local shells usually do not have `DATABASE_URL`, and the app service `DATABASE_URL` may point at Railway's private hostname (`postgres.railway.internal`), which is not reachable from this machine.
- For Drizzle schema pushes, use the Railway database service's public URL by running:
  `~/.local/bin/railway run -s "Viva Web Designs Database" -e production sh -lc 'DATABASE_URL="$DATABASE_PUBLIC_URL" npm run db:push'`
- After running a schema push, verify important columns or indexes with a read-only query against the same Railway database service.
- Never print or commit database connection strings or Railway secret values.

## Related Repositories

- Marketplace extension source: `/Users/matt/Projects/extension/chrome-extension/marketplace-assistant`

## Safety

- When the user asks what is happening, asks for analysis, or asks for an opinion about an issue, first explain the diagnosis and proposed fix, then wait for explicit confirmation before making changes. If the user directly asks for an action, proceed normally within the existing git and safety workflow.
- When replacing or updating logos, favicons, app icons, or other persistent brand assets, include a cache-busting strategy in the same change, such as updating the referenced asset URL with a version query string or using a new filename. Do this automatically as part of the asset replacement unless the user explicitly asks not to.
- Never discard, reset, or delete local work unless the user explicitly approves that exact cleanup.
- If cleanup is needed, preserve recovery points first with a backup branch or named stash.
- Prefer small, scoped changes that follow the existing codebase patterns.
