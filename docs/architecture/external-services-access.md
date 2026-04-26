# External Services Access

> Last updated: 2026-04-23

This document records the external systems currently used by the Viva platform and where their configuration is managed.

It is intentionally **reference-only**:
- include repo URLs, project names, service names, domains, env var names, and operational notes
- do **not** commit secret values, tokens, API keys, passwords, or connection strings

---

## GitHub

- Repository: `VivaWebDesigns/viva-final`
- URL: `https://github.com/VivaWebDesigns/viva-final`
- Default branch: `main`
- Railway production currently deploys from this repository and branch

Operational note:
- User permissions are account-specific. Write access is sufficient to push code, but admin access is not required for normal deploy work.

---

## Railway

- Workspace: `vivawebdesigns's Projects`
- Project: `viva-final`
- Production web service: `VivaWebDesigns.com`
- Production database service: `Viva Web Designs Database`
- Public domains:
  - `https://vivawebdesigns.com`
  - `https://www.vivawebdesigns.com`
  - Railway service domain: `viva-final-production.up.railway.app`

Configuration notes:
- Runtime app secrets should live in Railway service variables for `VivaWebDesigns.com`
- Do not commit Railway secret values into the repo
- Local CLI access has been verified on this machine
- Local Railway CLI binary path: `~/.local/bin/railway`
- This checkout is linked to Railway project `viva-final` in the `production` environment
- Useful CLI checks:
  - `railway status`
  - `railway variable list -s VivaWebDesigns.com -e production`

Operational status verified on 2026-04-23:
- Railway CLI authentication succeeded for the current operator account
- `railway status` resolves this checkout to project `viva-final`, environment `production`
- Production variable inspection is available through the CLI

---

## Mailgun

- Provider role: outbound notification email delivery
- Current sending domain: `mg.vivawebdesigns.com`
- Current sender address: `noreply@mg.vivawebdesigns.com`
- Required runtime env vars:
  - `MAILGUN_API_KEY`
  - `MAILGUN_DOMAIN`
- Optional runtime env vars:
  - `MAILGUN_FROM_EMAIL`
  - `MAILGUN_FROM_NAME`

Management notes:
- The Mailgun API key is managed outside the repo and should be stored in Railway and/or local ignored env files only
- Viva currently uses Mailgun for **send-only** notification delivery
- Inbound Mailgun reply handling is **not** implemented in this repo

---

## Cloudflare

- DNS zone: `vivawebdesigns.com`
- Mailgun sending DNS is attached to the dedicated subdomain `mg.vivawebdesigns.com`
- Mailgun-related DNS records should remain **DNS only** (not proxied)
- Local Cloudflare DNS API access has been verified on this machine
- Local Cloudflare CLI access is available via `~/.bun/bin/bunx wrangler`

Current Mailgun send-side DNS shape:
- SPF TXT on `mg.vivawebdesigns.com`
- DKIM CNAME records under `pdk1._domainkey.mg.vivawebdesigns.com` and `pdk2._domainkey.mg.vivawebdesigns.com`
- Tracking CNAME `email.mg.vivawebdesigns.com`

Protection notes:
- Root-domain mail routing on `vivawebdesigns.com` must not be overwritten when working on Mailgun DNS
- Existing non-Mailgun records such as Google Workspace, SES, DMARC, and Railway verification records should be preserved unless there is an explicit migration plan

Operational status verified on 2026-04-23:
- A local ignored env file contains a Cloudflare API token for the Viva zone
- The token was verified against the Cloudflare API and has active DNS read/edit access for zone `vivawebdesigns.com`
- The token value must remain in local ignored env files only and must not be copied into tracked docs

---

## Local Secret Handling

- Use `.env.local` for local-only secrets when needed
- `.env*` files are ignored by git, except for `.env.example`
- `.env.example` should contain placeholders and safe defaults only
- Current local operator setup includes `.env.local` values for Cloudflare DNS and Mailgun
- Treat local env files as machine-specific operator state, not as project configuration to commit
- Never commit:
  - API keys
  - personal access tokens
  - database passwords
  - Cloudflare tokens
  - Mailgun secret keys

---

## Quick Recovery Checklist

When setting up a new machine or fresh checkout:

1. Clone `VivaWebDesigns/viva-final`
2. Verify GitHub access to the repo
3. Install or confirm local access to Railway CLI and Cloudflare tooling
4. Authenticate Railway CLI and link it to project `viva-final`
5. Confirm Railway production vars for Mailgun are present
6. Confirm `mg.vivawebdesigns.com` is the active Mailgun sending domain
7. Confirm the Mailgun DNS records in Cloudflare are still present and unproxied
