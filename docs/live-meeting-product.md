# Live Meeting Product Status

YoMeets now has a local live-meeting core that can be driven by fixture audio turns today and real capture providers later.

## What Runs Locally

- `@yomeets/audio-core` defines recorder, STT, diarization, and diarized segment interfaces.
- `FixtureAudioPipeline` produces realistic diarized turns for repeatable local demos.
- `runLiveMeeting()` ingests diarized segments, stores transcript segments, runs the incremental meeting window processor, applies operations, and checks speaker identity.
- `resolveSpeakerIdentities()` keeps uncertainty explicit: unknown, likely, confirmed.
- `reconcileMeeting()` reports duplicate actions, unresolved ownership, open questions, superseded decisions, and evidence clips.
- `askYoMeets()` retrieves structured meeting memory and answers with citations through the existing model-provider interface.

## Demo Commands

```bash
pnpm demo:live-meeting
```

Runs the local fixture demo with no external side effects.

```bash
pnpm demo:transcript-lines
```

Runs caption-style lines through the same live meeting core. You can pass a file where each line looks like `00:12 S2: I'll fix it tomorrow`.

```bash
GEMINI_API_KEY=... pnpm smoke:meeting-window
```

Runs the live meeting window prompt against Gemini.

Open the local dashboard directly:

```bash
open apps/desktop/index.html
```

## Still Needs Real-World Adapters

- Real microphone/system-audio capture.
- Streaming STT provider.
- Streaming diarization provider.
- API-backed UI data loading from the local server.
- Real approval-to-execution wiring from live meeting actions into GitHub, Calendar, and Gmail.

## Hardening Checklist

- Measure live window latency.
- Measure speaker likely/confirmed accuracy.
- Measure action and decision precision/recall.
- Simulate STT gaps, diarization speaker swaps, model malformed JSON, and duplicate operation output.
- Verify duplicate-side-effect prevention once live actions connect to execution.
- Run final reconciliation after meeting end and record correction rate.
