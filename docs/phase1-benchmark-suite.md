# Phase 1 Benchmark Suite

Run the benchmark suite with:

```bash
pnpm --filter @yomeets/cli build
node apps/cli/dist/main.js benchmark phase1
```

Run the fault-injection benchmark with:

```bash
pnpm --filter @yomeets/cli build
node apps/cli/dist/main.js benchmark phase2
```

The suite runs 24 deterministic tasks against the fake network-site model:

- normal connection requests
- profile-only searches
- ambiguous names
- missing profiles
- already-pending connections
- already-sent connections

Each task goes through parser, validator, planner, benchmark agent execution, SQLite persistence, browser-core verification, and a final deterministic checker. A task passes only when the persisted task status and the fake-site state match the task expectation.

Phase 2 toggles these faults one at a time:

- stale or missing DOM elements
- network timeout
- extension disconnect
- malformed model JSON
- partial side effect where the action committed but confirmation failed
- duplicate action firing
