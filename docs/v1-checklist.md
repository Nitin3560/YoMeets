# V1 Checklist

## Complete Enough For Local V1

- Monorepo builds and type-checks across CLI, extension, and packages.
- Fake network site supports deterministic people search, profiles, connect flow, note entry, pending state, and send error.
- Chrome extension can observe page state and execute browser actions through stable element refs.
- Browser-core has action, observation, expected outcome, and verification types.
- SQLite storage has task, intent, plan, action, verification, approval, and audit tables.
- Task intake stores raw commands before parsing.
- Model parsing produces validated task intent JSON with retry on malformed output.
- Planner creates deterministic plan steps and versioned plan storage.
- Agent-core has state transitions, policy checks, trace previews, checklist formatting, failure classes, retries, loop detection, and recovery checkpoints.
- CLI supports serving the local API, submitting typed commands, submitting transcript commands, previewing a scripted scenario trace, and terminal approvals.

## Still Stubbed Behind Interfaces

- The agent loop does not yet drive Chrome end to end from the CLI.
- Model provider is scripted in tests and previews.
- Approval requests are modeled and prompted, but not persisted through a full live task.
- Crash recovery checkpoints are planned, not resumed from disk.
- Voice input starts at transcript text; microphone capture is intentionally out of the local CLI scope.

## V1 Acceptance Targets

- Run the John Smith connection scenario on the fake site without duplicate sends.
- Persist every action, verification result, approval, and audit transition.
- Re-observe and re-plan once when a structural failure or loop is detected.
- Verify external state before retrying after an unknown commit.
- Keep sensitive browser state local and send only minimal task context to the model boundary.
