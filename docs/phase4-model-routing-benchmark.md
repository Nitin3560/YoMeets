# Phase 4 Model Routing Benchmark

Run the model comparison with:

```bash
pnpm --filter @yomeets/cli build
node apps/cli/dist/main.js benchmark phase4
```

Providers:

- `local`: built-in heuristic parser, no token cost
- `openai`: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, default `gpt-5.1`
- `anthropic`: `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`, default `claude-sonnet-4-5`
- `ollama`: local Ollama server, optional `OLLAMA_MODEL`, default `llama3.1:8b`

The table reports provider availability, Phase 1 success rate, invalid-JSON rate, total latency, token counts, and estimated token cost.

If a hosted API key is missing or Ollama has no running model, that provider is marked unavailable and the error column shows why. That keeps the comparison table real: missing provider access is measured as missing access, not replaced with guessed numbers.

Pricing assumptions:

- OpenAI `gpt-5.1`: $1.25 / 1M input tokens and $10 / 1M output tokens
- Anthropic Claude Sonnet 4.5: $3 / 1M input tokens and $15 / 1M output tokens
- Ollama/local: $0 local token cost

Reference docs:

- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses
- Anthropic Messages API: https://docs.anthropic.com/en/api/messages
- Ollama generate API: https://github.com/ollama/ollama/blob/main/docs/api.md
