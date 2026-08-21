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
