# V1 Checklist

## Product Definition

YoMeets V1 is a local-first meeting-to-execution agent for software teams. It converts engineering meeting transcripts into approved, verified actions in GitHub, Google Calendar, and Gmail.

The fake network site remains a deterministic benchmark target for safety and recovery behavior. It should not be mistaken for the product domain.

## Complete Enough For Local V1

- Monorepo builds and type-checks across CLI, extension, and packages.
- Fake network site supports deterministic external-effect testing for observe, click, verify, retry, and duplicate-send behavior.
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
- GitHub, Google Calendar, and Gmail adapters are not implemented yet.
- Voice input starts at transcript text; microphone capture is intentionally out of the local CLI scope.

## V1 Acceptance Targets

- Extract commitments, owners, deadlines, decisions, and follow-ups from engineering meeting transcripts.
- Create or update GitHub issues only after approval.
- Schedule or reschedule Google Calendar follow-ups only after approval.
- Draft or send Gmail follow-ups only after approval.
- Track unresolved commitments into the next meeting.
- Run the fake-site external-effect scenario without duplicate sends.
- Persist every action, verification result, approval, and audit transition.
- Re-observe and re-plan once when a structural failure or loop is detected.
- Verify external state before retrying after an unknown commit.
- Keep sensitive browser state local and send only minimal task context to the model boundary.
