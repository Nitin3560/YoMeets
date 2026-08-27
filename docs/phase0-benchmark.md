# Phase 0 Benchmark

Phase 0 exists to prove the system can produce meaningful benchmark numbers.

## Text Command Path

Command:

```bash
node apps/cli/dist/main.js phase0 "Find John Smith at Google and send a connection request with 'Hello John.'"
```

Observed result:

```text
Task <id>: completed
Verification: passed
TASK_RECEIVED -> PARSED -> PLAN_CREATED -> NAVIGATE -> SEARCH -> PROFILE_OPENED -> TARGET_VERIFIED -> CONNECT_CLICKED -> NOTE_DIALOG_OPENED -> MESSAGE_TYPED -> SEND_CLICKED -> PENDING_DETECTED -> COMPLETED
```

Persisted records after one run:

```text
tasks: 1
task_intents: 1
task_plans: 1
actions: 1
verification_results: 1
audit_events: 4
```

## Chrome Extension Check

Real Chrome was launched with:

```bash
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/tmp/yomeets-phase0-chrome-debug --remote-debugging-port=9222 --load-extension=apps/chrome-extension/dist http://127.0.0.1:3000
```

The built observer and executor scripts from `apps/chrome-extension/dist` were injected into the fake-site tab. They observed the Connect button, clicked it, observed the Note textbox, typed `Hello John.`, clicked Send, and `browser-core` verification passed on `textAppears: Pending`.

Note: Chrome's MV3 service worker appeared after launch and later went idle, which is normal. The verified smoke used the built extension content scripts directly through Chrome DevTools Protocol.
