# Phase 3 Integration Smoke Test

Run this only against test accounts or disposable test resources.

## Required Environment

- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GOOGLE_ACCESS_TOKEN`
- `GMAIL_SMOKE_TO`

Optional:

- `GITHUB_ASSIGNEE`
- `GOOGLE_CALENDAR_ID`

## Command

```bash
pnpm build
node scripts/smoke-integrations.mjs
```

## Expected Result

The script creates:

- one GitHub issue
- one Google Calendar event
- one Gmail draft

It prints a table with provider, external ID, and URL when the provider returns one.
