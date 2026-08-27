# Phase 3 Side-Effect Safety Proof

Run the crash-safety proof with:

```bash
pnpm --filter @yomeets/cli build
node apps/cli/dist/main.js benchmark phase3
```

Current external-effect actions:

- `connect`

The proof forces crashes around the connection-request send boundary, restarts the task, then checks the simulated database state and fake-site state. A row passes only when the final state does not duplicate the send.

The important crash point is `after_send_before_confirmation`: the fake site has already recorded the send, but the task has not yet persisted confirmation. Recovery must inspect external state before sending again.
