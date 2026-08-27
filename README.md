# YoMeets

Local-first meeting automation system.

## Scripts

- `pnpm build`
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`

## Local Runner

```bash
pnpm --filter @yomeets/cli dev
```

## Chrome Extension

Build the extension, then load `apps/chrome-extension/dist` as an unpacked extension in Chrome.

```bash
pnpm --filter @yomeets/chrome-extension build
```

## Fake Network Site

```bash
pnpm --filter @yomeets/fake-site-network dev
```

## End-to-End Demo

```bash
pnpm --filter @yomeets/cli build
node apps/cli/dist/main.js demo phase5 --record artifacts/phase5-demo.cast
```

## Local-Only Scope

YoMeets V1 is a local system, not a packaged desktop app. The agent API, task state, browser bridge, SQLite database, approvals, and transcript input all run on the local machine.

Out of scope for V1:

- packaged Electron app, installer, auto-update, or app icon
- hosted multi-user service
- long-term memory, reusable skills, scheduled routines, and third-party connectors
- blind retries after an external side effect

## Security Notes

- Keep cookies, passwords, full DOM snapshots, and SQLite task history local.
- Send only the current task goal, selected page observation, and recent relevant history to a model provider.
- Require terminal approval before external side-effect actions such as sending a connection request.
- Treat unknown commits as inspect-first recovery: verify external state before retrying.
