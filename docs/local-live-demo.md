# Local Live Demo

This is the closest current path to the final product demo without native audio permissions or paid STT/diarization services.

## Run It

```bash
pnpm demo:seed-dashboard
pnpm --filter @yomeets/cli dev
```

Then open:

```bash
apps/desktop/index.html
```

The dashboard connects to `127.0.0.1:47821`, receives meeting state over SSE, and falls back to polling if the stream is unavailable.

## What Works

- Persistent demo meeting in `yomeets.sqlite`.
- Live transcript-shaped segments.
- Actions, decisions, and superseded decisions.
- Speaker confirmation endpoint.
- Dashboard Confirm button.
- Dashboard Approve button using dry-run execution.
- Evidence clip metadata display.

## What Still Needs Real Providers

- Native microphone and system-audio capture.
- Streaming STT audio input. Deepgram credentials and adapter support are available with `DEEPGRAM_API_KEY`.
- Streaming diarization.
- Playable audio file generation.
- Real OAuth/token setup for Google and GitHub.
- Postgres/pgvector semantic memory.

Use:

```bash
pnpm --filter @yomeets/cli build
node apps/cli/dist/main.js doctor
```

to check which provider credentials are configured without printing secrets.

## Postgres Memory

With a local pgvector database configured:

```bash
export YOMEETS_POSTGRES_URL="postgres://USER:PASSWORD@127.0.0.1:5432/yomeets"
pnpm smoke:postgres-memory
```

Replace `USER:PASSWORD` with your local Postgres credentials. The smoke command creates the pgvector table, upserts local meeting memory, and searches it through Postgres.
