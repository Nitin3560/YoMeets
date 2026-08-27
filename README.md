# YoMeets — Meeting-to-Execution Agent

YoMeets turns decisions and commitments from engineering meetings into verified actions across the tools where work actually happens.

Meeting summarizers tell you what was discussed. YoMeets is built for the next step: extract owners, deadlines, decisions, and follow-ups from a transcript; generate an execution plan; ask for approval before external side effects; execute approved actions; verify completion; and track what remains unresolved before the next meeting.

## Product Focus

Small engineering teams lose work between meetings and execution. Decisions get buried in transcripts, action items become manual admin, and follow-ups depend on someone remembering to create tickets, update calendars, send notes, and check whether the work actually happened.

YoMeets is designed around this loop:

```text
Conversation -> Commitments -> Review -> Execute -> Verify -> Track -> Next meeting
```

V1 is intentionally narrow:

- GitHub issues for engineering work
- Google Calendar follow-ups and schedule changes
- Gmail drafts or approved follow-up messages
- local SQLite state for commitments, actions, approvals, verification, and recovery
- browser automation only as a fallback when an API is not available

The current fake network site is a deterministic proving ground for execution safety: approvals, retries, verification, idempotency, and benchmark evidence. It is not the long-term product workflow.

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

The fake site is a benchmark target for external-effect safety and browser verification.

```bash
pnpm --filter @yomeets/fake-site-network dev
```

## End-to-End Demo

```bash
pnpm --filter @yomeets/cli build
node apps/cli/dist/main.js demo phase5 --record artifacts/phase5-demo.cast
```

## Local-Only Scope

YoMeets V1 is a local system, not a packaged desktop app. Transcript parsing, task state, browser bridge, SQLite database, approvals, benchmarks, and execution tracking all run on the local machine.

Out of scope for V1:

- packaged Electron app, installer, auto-update, or app icon
- hosted multi-user service
- broad third-party connector marketplaces
- generic meeting summarization as the main product
- blind retries after an external side effect

## Evaluation Targets

YoMeets should be measured by whether meeting commitments become correct, verified work:

- commitment extraction precision and recall
- owner and deadline accuracy
- execution success rate
- verification accuracy
- duplicate side-effect rate
- recovery success rate
- human correction rate
- minutes of post-meeting admin eliminated

## Security Notes

- Keep cookies, passwords, full DOM snapshots, and SQLite task history local.
- Send only the current task goal, selected page observation, and recent relevant history to a model provider.
- Require terminal approval before external side-effect actions such as creating issues, moving calendar events, or sending messages.
- Treat unknown commits as inspect-first recovery: verify external state before retrying.
