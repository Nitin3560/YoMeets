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
- Dedicated YoMeets Postgres + pgvector container.
- Deepgram streaming STT adapter for `linear16` audio.
- macOS ffmpeg recorder boundary for microphone or BlackHole-style system audio devices.

## What Still Needs Real Providers

- Native audio permission flow in the desktop shell.
- Streaming diarization.
- Playable audio file generation.
- Real OAuth/token setup for Google and GitHub.
- Postgres-backed Ask YoMeets wiring in the product UI.

## macOS Audio

For the MVP, install `ffmpeg` and a system-audio device such as BlackHole 2ch. The recorder uses ffmpeg's `avfoundation` input and sends `linear16` PCM chunks to the STT provider.

```bash
brew install ffmpeg
```

Run a real microphone stream through Deepgram and the live YoMeets processor:

```bash
pnpm live:audio -- --device "MacBook Pro Microphone" --title "Engineering Sync"
```

For system audio, select your BlackHole device:

```bash
pnpm live:audio -- --device "BlackHole 2ch" --source system --title "Engineering Sync"
```

Stop with Ctrl+C, then execute detected live actions in dry-run mode:

```bash
node apps/cli/dist/main.js execute-live-actions <meeting-id> --dry-run --yes
```

Use:

```bash
pnpm --filter @yomeets/cli build
node apps/cli/dist/main.js doctor
```

to check which provider credentials are configured without printing secrets.

## Postgres Memory

Start the dedicated YoMeets pgvector database:

```bash
pnpm postgres:up
export YOMEETS_POSTGRES_URL="postgres://yomeets:yomeets_dev_password@127.0.0.1:55432/yomeets"
pnpm smoke:postgres-memory
```

The smoke command creates the pgvector table, upserts local meeting memory, and searches it through Postgres.

When `GEMINI_API_KEY` is present, Postgres memory uses `gemini-embedding-2` with 768-dimensional vectors. Without a key, it falls back to a local deterministic vector for development only.

## Desktop Shell

The MVP shell is Tauri-based and wraps the local dashboard with an always-on-top listening overlay window.

```bash
pnpm desktop:dev
```

Packaging requires the normal Tauri macOS toolchain to be installed locally.
