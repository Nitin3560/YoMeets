# Remaining Product Blocks

This is the honest path from the current local core to a finished YoMeets product.

1. Real audio capture: replace `FixtureAudioPipeline` with microphone and system-audio capture.
2. Real streaming STT: convert live speech into timestamped text continuously.
3. Real streaming diarization: map actual voices into stable S1/S2/S3 speaker clusters.
4. Speaker identity resolution: add richer reasoning, correction history, late joiners, overlapping speakers, and safer action blocking.
5. Live UI data: connect the dashboard to API or WebSocket state for transcript, actions, decisions, questions, approvals, and meeting history.
6. Desktop shell and overlay: add start/stop lifecycle, permissions, settings, integrations, and the small listening overlay.
7. Live action execution: route live actions through approval, execution, verification, and storage.
8. Playable evidence clips: seek into the recorded meeting audio at each evidence span.
9. Final reconciliation: use the finalized transcript to merge duplicates and correct owners, deadlines, and superseded decisions.
10. Ask YoMeets retrieval: move toward Postgres, pgvector, semantic retrieval, structured filters, temporal reasoning, and supersession-aware answers.
11. Accounts and integration auth: productize local credentials, OAuth, profiles, and settings.
12. Recovery and reliability: add idempotency, retry queues, crash recovery, duplicate operation prevention, and offline provider behavior.
13. Real evaluation: measure latency, diarization accuracy, extraction precision and recall, execution success, reconciliation correction rate, and citation quality.
14. Final UX polish and demo: record a real or staged meeting and show listening, live extraction, approval, verified external action, evidence playback, and cross-meeting answers.

## Current Local Evaluation Command

```bash
pnpm eval:live-core
```

This runs the deterministic live-core demo and prints:

- live event count
- extracted actions
- detected decision supersession
- unresolved identity count
- evidence clip count
- Ask YoMeets answer and citations

It is a repeatable local harness, not a substitute for the later real-meeting evaluation suite.
