# External Services Access

> Last updated: 2026-04-16

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
- Useful CLI checks:
  - `railway status`
  - `railway variable list -s VivaWebDesigns.com -e production`

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

Current Mailgun send-side DNS shape:
- SPF TXT on `mg.vivawebdesigns.com`
- DKIM CNAME records under `pdk1._domainkey.mg.vivawebdesigns.com` and `pdk2._domainkey.mg.vivawebdesigns.com`
- Tracking CNAME `email.mg.vivawebdesigns.com`

Protection notes:
- Root-domain mail routing on `vivawebdesigns.com` must not be overwritten when working on Mailgun DNS
- Existing non-Mailgun records such as Google Workspace, SES, DMARC, and Railway verification records should be preserved unless there is an explicit migration plan

---

## Local Secret Handling

- Use `.env.local` for local-only secrets when needed
- `.env*` files are ignored by git, except for `.env.example`
- `.env.example` should contain placeholders and safe defaults only
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
3. Link Railway CLI to project `viva-final`
4. Confirm Railway production vars for Mailgun are present
5. Confirm `mg.vivawebdesigns.com` is the active Mailgun sending domain
6. Confirm the Mailgun DNS records in Cloudflare are still present and unproxied
