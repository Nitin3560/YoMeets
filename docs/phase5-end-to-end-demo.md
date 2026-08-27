# Phase 5 End-to-End Demo

Run the reproducible local demo with:

```bash
pnpm --filter @yomeets/cli build
node apps/cli/dist/main.js demo phase5 --record artifacts/phase5-demo.cast
```

The demo shows:

- typed sentence
- parser output
- planner trace
- fake-site browser actions
- terminal approval prompt
- verification result
- final SQLite task status
- final fake-site profile status

The `--record` file is an asciinema v2 cast. To replay it:

```bash
asciinema play artifacts/phase5-demo.cast
```

This demo uses the deterministic fake network site model inside the benchmark package. It does not require hosted model keys, real account cookies, or external network access.
