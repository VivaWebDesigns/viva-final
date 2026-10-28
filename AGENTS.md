# Agent Instructions

## Git Workflow

- This repo is worked on from two computers with both Claude and Codex, so local `main` is often behind `origin/main`. At the start of every session, before reading or editing code, run `sh .claude/hooks/git-sync.sh` (Claude Code runs it automatically at startup; run it again if its output is not in context). It fast-forwards clean `main` with `git pull --ff-only` and reports when it skipped.
- If the sync reports a skip or failure (local changes, another branch, diverged history, offline), stop and explain it to the user before editing. Never resolve divergence by merging, rebasing, resetting, or force-pushing without explicit approval.
- If the sync reports that `package.json` changed, run `npm install`. If schema files changed, mention it; do not push the schema unless asked.
- Then run `git fetch --prune` and check the current repo, branch, remote, and `git status --short --branch`.
- Work from clean `main` unless the user explicitly asks for another branch.
- Immediately before pushing, run `git pull --rebase` so work pushed from the other computer is included. If the rebase conflicts, run `git rebase --abort` and stop to ask the user; do not resolve conflicts on your own.
- If local changes already exist, identify them before editing. Do not mix new work into unrelated changes.
- Stage only files that belong to the user's requested task.
- After completing a user-requested file change, validate the change, then automatically create a clear, focused commit and push it to the intended branch, usually `main` when Replit or production sync is expected.
- If pre-existing local changes are present, do not mix scopes. Stage, commit, and push only the files that belong to the current requested task. If the current task cannot be safely separated from existing local changes, stop and explain the blocker before committing or pushing.
- After committing or pushing, report the commit hash, repository, and branch.
- Do not leave stale task branches, temporary worktrees, unpushed requested commits, or unrelated staged files behind.

## Post-push deployment boundary

Once the requested changes have been pushed successfully, do not poll Railway, inspect Railway deployment status or logs, wait for a Railway deployment, fetch or curl the production website or API, or run `git pull` to determine whether Railway has deployed the changes.

Only perform post-push deployment monitoring or live-production verification when I explicitly request it in the current task. Otherwise, treat the successful push as the completion boundary and report that the push succeeded and that the Railway deployment was not verified.

## Database Schema Changes

- This project deploys on Railway. Local shells usually do not have `DATABASE_URL`, and the app service `DATABASE_URL` may point at Railway's private hostname (`postgres.railway.internal`), which is not reachable from this machine.
- The database has no public address (removed after Railway's October 2026 security incident; do not add it back). Reach it through Railway's private SSH tunnel with `scripts/with-railway-db.sh`, which sets `DATABASE_URL` for one command. For Drizzle schema pushes run:
  `sh scripts/with-railway-db.sh npm run db:push`
- After running a schema push, verify important columns or indexes with a read-only query against the same Railway database service.
- Never print or commit database connection strings or Railway secret values.

## Local Dominator API

- Base URL `https://api.localdominator.co`, sent as `Authorization: Bearer <key>`. The web app's backend (`backend.localdominator.co`) rejects this key.
- The key is the Railway variable `LOCAL_DOMINATOR_API_KEY` on the VivaWebDesigns.com service (production). Read it like `LOCAL_FALCON_API_KEY`; never print or commit it.
- Docs: https://app.localdominator.co/api-doc. Useful reads: `GET /v1/scans` and `GET /v1/scans/{scan_id}/results`. The Charlotte-area roofing master scan is `a16b5878-abcf-48f8-a9c1-4c04d45860f5`.
- Read only by default. Starting scans (`POST /v1/scans`, scheduled scans) uses credits and `DELETE` removes scans; ask first.

## Related Repositories

- Marketplace extension source: `/Users/matt/Projects/extension/chrome-extension/marketplace-assistant`

## Safety

- When the user asks what is happening, asks for analysis, or asks for an opinion about an issue, first explain the diagnosis and proposed fix, then wait for explicit confirmation before making changes. If the user directly asks for an action, proceed normally within the existing git and safety workflow.
- When replacing or updating logos, favicons, app icons, or other persistent brand assets, include a cache-busting strategy in the same change, such as updating the referenced asset URL with a version query string or using a new filename. Do this automatically as part of the asset replacement unless the user explicitly asks not to.
- Never discard, reset, or delete local work unless the user explicitly approves that exact cleanup.
- If cleanup is needed, preserve recovery points first with a backup branch or named stash.
- Prefer small, scoped changes that follow the existing codebase patterns.
