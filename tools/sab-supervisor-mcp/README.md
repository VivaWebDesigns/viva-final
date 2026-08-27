# Local SAB supervisor

This standalone macOS utility has two deliberately separate components:

- `register_sop_for_review`: stores one immutable, content-addressed copy of the exact private SOP revision Claude read through its authenticated connector.
- `review_sab_checkpoint`: an event-driven, read-only MCP tool that runs one isolated local `codex exec` review against the registered SOP and run state supplied in that call.
- `review_sab_scan_plan`: reviews an exact Local Falcon scan proposal and, when mechanically permitted by that registered SOP, returns a delegated structured authorization.
- `sab-permission-watcher`: a native Swift Accessibility watcher that approves only confidently identified, routine Claude-in-Chrome public-site prompts and resumes an exact Claude Desktop tool-use-limit notice.

It does not import or modify Viva's production SAB MCP, write workflow data, launch scans itself, or retain run state between reviews. The only retained review inputs are immutable registered SOP revisions; each run still supplies its own concise durable state and rulings.

## Install

Requirements: macOS, Chrome with Claude in Chrome installed, Node 20 or newer, Swift 6 or newer, and a signed-in local Codex CLI.

```sh
cd /Users/matt/Projects/viva/tools/sab-supervisor-mcp
npm ci
cp config.example.json config.json
npm run build
node dist/cli.js install-service
```

The build creates a minimal ad-hoc-signed `build/SAB Permission Watcher.app`. `install-service` copies that signed bundle to the stable runtime location `~/Applications/SAB Permission Watcher.app` and writes the LaunchAgent without starting it. Existing configuration and logs are preserved.

`config.json` is optional and ignored by Git. Set `SAB_SUPERVISOR_CONFIG` to use a config elsewhere. The checked-in defaults target the installed Claude extension ID and use `codex` from `PATH`; the example uses the Codex binary bundled with the desktop app.

## Claude MCP configuration

Add this server to Claude Desktop's MCP configuration, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "viva-sab-local-supervisor": {
      "command": "/usr/local/bin/node",
      "args": [
        "/Users/matt/Projects/viva/tools/sab-supervisor-mcp/dist/cli.js",
        "mcp"
      ],
      "env": {
        "SAB_SUPERVISOR_CONFIG": "/Users/matt/Projects/viva/tools/sab-supervisor-mcp/config.json"
      }
    }
  }
}
```

Give Claude the fixed instruction in `prompts/claude-instruction.md`. That instruction is what causes Claude to register the exact private SOP once, invoke the checkpoint reviewer before ending a meaningful checkpoint turn, invoke the scan-plan reviewer before a paid Local Falcon stage, and route every approved scan through Viva SAB Workflow's durable `run_sab_scan_once` guard. Claude must not call the direct Local Falcon save or scan tools after supervisor approval. The MCP server itself does not independently detect completed or paused Claude responses.

Claude reads the private document through its authenticated Drive connector and registers its source URL, title/version, Drive revision ID when available, and complete exact text. Registration returns a handle bound to the source identity, revision, and content hash. The same exact registration is idempotent; a different source, revision, or document content receives a different handle. Both reviewers resolve and verify that immutable local copy. No SOP, trade, market, keyword, workflow sheet, report, or run is configured as a default.

Checkpoint calls then supply the registered handle, Claude's latest checkpoint message, a concise durable run-state summary, and relevant explicit user rulings. The reviewer has no cross-run state.

After a review, Claude immediately follows `continue`, `correct`, or `reconcile` instructions in a private review-and-correction loop and keeps working. These non-stopping verdicts are written to the structured audit log instead of being relayed to Matt. Claude stops for the user only when the verdict is `user_ruling_required` or `approval_required`; `user_ruling_required` is reserved for a genuine business or policy choice that the SOP and durable evidence cannot resolve. `handoff_ready` confirms that an incomplete run has a necessary, verified continuation package; `complete` is reserved for the fully finished run objective. Payload size, a long checkpoint, an unsupported context-limit guess, missing readback, or an unverified tool-availability claim does not justify a user interruption.

Before Claude may report that a named tool is missing or unavailable, it must attempt the exact call when the inputs are known or inspect current tool-discovery evidence, and preserve the exact error or discovery result. Memory-based tool inventories are not evidence.

Before every paid Local Falcon stage, Claude submits the exact plan to `review_sab_scan_plan`. A `scan_approved` result contains the authorization ID, exact scans/Place IDs/centers/specifications, listed prerequisite save-location calls, mechanically reconciled credit total, applicable SOP rule, timestamp, and exclusions. Claude may immediately execute only that exact record. `correct` causes correction and resubmission; `user_ruling_required` stops for Matt. Eligibility failures, duplicates, unsupported centers/specifications, excess auxiliaries or recenters, ambiguous retries, material exceptions, changed master parameters, CRM export, and unrelated account changes or purchases are outside delegated authority.

For initial observation runs, Claude displays the verdict, authorization ID, exact scans and credits, problems/corrections, and action taken. This affects only future runs started with the fixed instruction; it does not attach to or alter an already-running workflow.

## Accessibility authorization

1. Complete `npm run build` and `node dist/cli.js install-service` first.
2. Run `node dist/cli.js start` once. Before authorization it may exit with code 2, but the signed app will appear in Accessibility.
3. Open **System Settings → Privacy & Security → Accessibility** and enable **SAB Permission Watcher**. If it is not already listed, click **+**, open your home `Applications` folder, and add `~/Applications/SAB Permission Watcher.app`.
4. Run `node dist/cli.js start` again, then verify with `node dist/cli.js status`.
5. Screen Recording is optional and is used only to capture a diagnostic screenshot when an unrecognized prompt fails closed. The watcher checks existing authorization without requesting it; when access is absent, it skips the screenshot and never opens or triggers the macOS Screen Recording prompt.

Do not add the raw executable under `swift/.build`; the LaunchAgent and foreground commands execute the signed app's `Contents/MacOS/sab-permission-watcher`. The watcher does not use screen coordinates.

The bundle identifier and install path are stable. Rebuilding skips bundle replacement and signing when the executable and `Info.plist` are unchanged, and `install-service` likewise leaves an identical installed app untouched. A genuine watcher code change necessarily changes the signature, but does not change the bundle identifier or installed path.

## Operation

From this directory:

```sh
npm run mcp                 # reviewer only, MCP over stdio
npm run watcher             # watcher only, foreground
npm run dry-run             # inspect one current prompt without clicking
npm run all                 # MCP reviewer plus watcher, foreground
node dist/cli.js install-service
node dist/cli.js start
node dist/cli.js stop
node dist/cli.js restart
node dist/cli.js status
node dist/cli.js logs
node dist/cli.js analyze-usage --since 2026-08-26T14:00:00Z
```

For unattended use, run the reviewer from Claude's MCP configuration and run the watcher as the LaunchAgent. `all` is useful when one parent process must own both; watcher output is redirected so it cannot corrupt MCP stdio.

Structured logs default to `~/.local/state/viva-sab-supervisor/`:

- `reviews.jsonl`: review ID, outcome, timing, registered SOP handle/content hash, input sizes, and Codex input/cached-input/output/reasoning token counts; it does not store SOP text, checkpoint content, or user rulings.
- `sops/content/` and `sops/registrations/`: mode-0600 immutable exact SOP copies and source/revision metadata, keyed by content and registration identity.
- `scan-approvals.jsonl`: full structured scan-review result and exact authorization when approved; it omits complete SOP text, credentials, durable-state prose, and unrelated run data.
- `watcher.jsonl`: timestamp, hostname, displayed permission type, action kind, selected semantic button, and result.
- `screenshots/`: diagnostics only for prompts that could not be safely classified.

Codex token telemetry comes from the structured `turn.completed` event emitted by
`codex exec --json`. If an older or incompatible CLI does not emit that event,
the review still works and the log records `token_usage_available: false`.
Telemetry never stores prompt or response content.

After a run, summarize only its time window with:

```sh
node dist/cli.js analyze-usage \
  --since 2026-08-26T14:00:00Z \
  --until 2026-08-26T20:00:00Z
```

Add `--json` for a machine-readable report. The summary combines checkpoint and
scan-plan reviews and reports token totals, cache rate, timing, prompt sizes,
verdict distribution, the five highest-token reviews, and focused efficiency
signals for frequent reviews, repeated correction/reconciliation, low cache
reuse, and reviewer failures. Time-window analysis keeps the supervisor
stateless and avoids adding another run identifier to Claude's required inputs.

## Real prompt inspection findings

Inspection used benign Claude-in-Chrome navigation requests on previously unapproved public domains while Chrome was in manual approval mode. macOS Accessibility exposed these prompt schemas:

- outer `AXWebArea`: `chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/sidepanel.html?...`;
- nested Claude task `AXWebArea` under `https://claude.ai/cic/...`;
- the original site prompt, with permission text beginning `Allow Claude to use the browser on`, a disabled action descriptor such as `Navigating to https://...`, and semantic `Allow once`, persistent-site approval, and `Deny` buttons;
- the current tool prompt, with `Permission request: browser_batch` or a single routine browser tool, a semantic JSON payload, and enabled buttons whose accessible labels include shortcuts (`Deny 1` and `Allow once 2`).
- a separate extension permission window whose URL contains `mcpPermissionOnly=true`, text identifies one navigation hostname, and semantic buttons expose `Allow this action`, `Decline`, and `Always allow actions on this site`;
- targetless `tabs_create_mcp` and `tabs_context_mcp` prompts used to create or inspect the isolated working tab;
- `javascript_tool` page-title reads. Only exact read-only `document.title` or title-and-current-URL expressions are accepted; arbitrary scripts remain fail-closed.

The watcher requires the exact extension/task or permission-window structure and semantic approval controls. For site prompts it validates the action descriptor and public hostname. For tool prompts it parses the exposed JSON, requires only recognized routine browser actions, and associates tab-only read/interaction prompts with the public page in the same Chrome window. It scans every Chrome window and matching side-panel task in each poll, presses only with `AXPress`, and prefers persistent site approval when available. It also scans Claude Desktop for the exact notice `Claude reached its tool-use limit for this turn.` and presses `Continue` only when that single enabled semantic button is contained in the same small notice. Unrelated or altered Continue controls are ignored. The packaged LaunchAgent test approved a real tab-create, navigation, persistent-site, title-read, and page-read flow on a previously unapproved public domain and confirmed that Claude resumed.

No hostname allowlist is used. Routine navigation, opening, reading, search, scrolling, inspection, viewing, clicking, and ordinary interaction on public hosts can be approved. Credential/login, OAuth/authorization, download/upload, purchase/payment/transfer, sensitive-information entry, submission/publishing, and destructive markers never classify as routine. Local and private hosts also fail closed.

If Claude or Chrome changes these Accessibility labels or hierarchy, the watcher makes no click. Candidate Claude permission prompts that fail classification are logged as `candidate_rejected` with the semantic permission type and rejection reason; payload contents are not copied into the log. The watcher also attempts a diagnostic screenshot and posts a notification. `inspect` provides bounded troubleshooting signals:

```sh
"$HOME/Applications/SAB Permission Watcher.app/Contents/MacOS/sab-permission-watcher" inspect --debug
```

## Tests and troubleshooting

```sh
npm run format:check
npm run typecheck
npm test
npm run build
```

The TypeScript suite uses mocked Codex executions for checkpoint verdicts, immutable private-SOP registration/revision isolation, delegated compliant scan approval, prerequisite saves, duplicate and eligibility gates, unsupported plans, excess auxiliaries/recenters, ambiguous retries, CRM export, exact credit reconciliation, audit details, and cross-run/SOP isolation. Neutral fixtures are never production defaults. The Swift suite covers the live prompt schemas, same-window tab context, separate permission windows, targetless tab tools, narrowly approved title reads, multiple Chrome windows/tab groups/side-panel tasks, persistent/fallback approval, the exact bounded Claude Desktop tool-use-limit continuation, protected and unknown prompts, retry bounds, and deduplication. The packaging test builds the release app and verifies its `APPL` structure, executable, `Info.plist`, bundle identifier, and complete ad-hoc signature.

Common failures:

- `Accessibility access is required`: add and enable `~/Applications/SAB Permission Watcher.app` in Accessibility, then restart the service.
- Accessibility appears enabled after installing a changed watcher binary, but the service still exits with code 2: remove the stale `SAB Permission Watcher` Accessibility row, add the app again from `~/Applications`, and restart the service. Ad-hoc signatures change when the executable changes.
- `Signed watcher app is missing`: run `npm run build`, followed by `node dist/cli.js install-service`.
- `Codex could not be started`: set `codexPath` in `config.json` to the installed CLI.
- `Codex review timed out`: increase `codexTimeoutMs` only if the exact supplied SOP is reachable and unusually slow to read.
- No dry-run match: leave the Claude permission prompt visible, run the native `inspect` command above, and review `watcher.jsonl`; no fallback coordinate click exists.

## Disable or uninstall

```sh
node dist/cli.js stop
node dist/cli.js uninstall
```

`uninstall` removes only the LaunchAgent. It preserves configuration and logs for recovery or audit. To remove Claude integration, also remove `viva-sab-local-supervisor` from Claude Desktop's MCP configuration.
