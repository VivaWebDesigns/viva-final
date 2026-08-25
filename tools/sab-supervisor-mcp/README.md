# Local SAB supervisor

This standalone macOS utility has two deliberately separate components:

- `review_sab_checkpoint`: an event-driven, read-only MCP tool that runs one isolated local `codex exec` review against the exact SOP and run state supplied in that call.
- `sab-permission-watcher`: a native Swift Accessibility watcher that approves only confidently identified, routine Claude-in-Chrome public-site prompts.

It does not import or modify Viva's production SAB MCP, write workflow data, execute paid actions, or retain run state between reviews.

## Install

Requirements: macOS, Chrome with Claude in Chrome installed, Node 20 or newer, Swift 6 or newer, and a signed-in local Codex CLI.

```sh
cd /Users/matt/Projects/viva/tools/sab-supervisor-mcp
npm ci
cp config.example.json config.json
npm run build
```

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

Give Claude the fixed instruction in `prompts/claude-instruction.md`. That instruction is what causes Claude to invoke the reviewer before ending a meaningful checkpoint turn; the MCP server itself does not independently detect completed or paused Claude responses. Each call supplies exactly four run-local inputs: the exact controlling SOP link/file, Claude's latest checkpoint message, a concise durable run-state summary, and relevant explicit user rulings. The reviewer has no default SOP and no cross-call state.

After a review, Claude immediately follows `continue`, `correct`, or `reconcile` instructions and keeps working. It stops for the user only when the verdict is `user_ruling_required` or `approval_required`, and stops normally for `complete`.

## Accessibility authorization

1. Run `npm run dry-run` once so macOS can identify the helper.
2. Open **System Settings → Privacy & Security → Accessibility**.
3. Enable the terminal used for foreground operation. For the background service, add and enable `/Users/matt/Projects/viva/tools/sab-supervisor-mcp/swift/.build/release/sab-permission-watcher` if macOS requests it.
4. Screen Recording is optional and is used only to capture a diagnostic screenshot when an unrecognized prompt fails closed.

The watcher does not use screen coordinates.

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
```

For unattended use, run the reviewer from Claude's MCP configuration and run the watcher as the LaunchAgent. `all` is useful when one parent process must own both; watcher output is redirected so it cannot corrupt MCP stdio.

Structured logs default to `~/.local/state/viva-sab-supervisor/`:

- `reviews.jsonl`: review ID, outcome, timing, safe SOP origin/basename, and input sizes; it does not store checkpoint content or user rulings.
- `watcher.jsonl`: timestamp, hostname, displayed permission type, action kind, selected semantic button, and result.
- `screenshots/`: diagnostics only for prompts that could not be safely classified.

## Real prompt inspection findings

Inspection used a real benign Claude-in-Chrome navigation request to IANA's public example-domain documentation while Chrome was in manual approval mode. macOS Accessibility exposed:

- outer `AXWebArea`: `chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/sidepanel.html?...`;
- nested Claude task `AXWebArea`: `https://claude.ai/cic/task/...`;
- disabled `AXButton`: `Navigating to https://www.iana.org/help/exam...`;
- permission text beginning `Allow Claude to use the browser on` (Chrome split the hostname into another accessibility node);
- enabled semantic buttons `Allow once`, `Always allow for this website`, and `Deny`.

The watcher therefore requires the exact extension/task nesting, the permission phrase, an enabled `Allow once` and `Deny`, and a recognized disabled browser-action descriptor. It extracts the public hostname from the descriptor, checks any complete prompt hostname for agreement, and presses with `AXPress`. It prefers `Always allow for this website` plus known wording variants, otherwise `Allow once`. The live dry run detected `www.iana.org`; the live approval selected persistent site access and confirmed that Claude resumed. Claude's prior automatic-approval setting was restored after the inspection.

No hostname allowlist is used. Routine navigation, opening, reading, search, scrolling, inspection, viewing, clicking, and ordinary interaction on public hosts can be approved. Credential/login, OAuth/authorization, download/upload, purchase/payment/transfer, sensitive-information entry, submission/publishing, and destructive markers never classify as routine. Local and private hosts also fail closed.

If Claude or Chrome changes these Accessibility labels or hierarchy, the watcher makes no click. It logs the mismatch, attempts a diagnostic screenshot, and posts a notification. `inspect` provides bounded troubleshooting signals:

```sh
swift/.build/release/sab-permission-watcher inspect --debug
```

## Tests and troubleshooting

```sh
npm run format:check
npm run typecheck
npm test
npm run build
```

The TypeScript suite uses mocked Codex executions for continue, correction, approval, reconciliation, timeout, and run/SOP isolation. Neutral fixture SOPs under `tests/fixtures/` verify that rules, state, and rulings are not carried between calls. The Swift suite covers routine, persistent/fallback approval, protected and unknown prompts, extension targeting, retry bounds, and deduplication.

Common failures:

- `Accessibility access is required`: enable the foreground terminal or release watcher binary in Accessibility settings, then restart it.
- `Watcher binary is missing`: run `npm run build`.
- `Codex could not be started`: set `codexPath` in `config.json` to the installed CLI.
- `Codex review timed out`: increase `codexTimeoutMs` only if the exact supplied SOP is reachable and unusually slow to read.
- No dry-run match: leave the Claude permission prompt visible, run the native `inspect` command above, and review `watcher.jsonl`; no fallback coordinate click exists.

## Disable or uninstall

```sh
node dist/cli.js stop
node dist/cli.js uninstall
```

`uninstall` removes only the LaunchAgent. It preserves configuration and logs for recovery or audit. To remove Claude integration, also remove `viva-sab-local-supervisor` from Claude Desktop's MCP configuration.
