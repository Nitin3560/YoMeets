import assert from "node:assert/strict";
import { AnthropicModelProvider, GeminiModelProvider, OllamaModelProvider, OpenAiModelProvider } from "./http-providers.js";

const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes("openai")) {
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer openai_test");

      return new Response(
        JSON.stringify({
          output_text: "{\"intent\":\"search_profile\",\"targets\":[{\"name\":\"John Smith\"}],\"action\":{\"type\":\"open_profile\"}}",
          usage: {
            input_tokens: 11,
            output_tokens: 13
          }
        })
      );
    }

    if (url.includes("anthropic")) {
      assert.equal((init?.headers as Record<string, string>)["x-api-key"], "anthropic_test");

      return new Response(
        JSON.stringify({
          content: [
            {
              text: "{\"intent\":\"search_profile\",\"targets\":[{\"name\":\"John Smith\"}],\"action\":{\"type\":\"open_profile\"}}",
              type: "text"
            }
          ],
          usage: {
            input_tokens: 17,
            output_tokens: 19
          }
        })
      );
    }

    if (url.includes("generativelanguage")) {
      assert.equal(new URL(url).searchParams.get("key"), "gemini_test");

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "{\"intent\":\"search_profile\",\"targets\":[{\"name\":\"John Smith\"}],\"action\":{\"type\":\"open_profile\"}}"
                  }
                ]
              }
            }
          ],
          usageMetadata: {
            candidatesTokenCount: 29,
            promptTokenCount: 31
          }
        })
      );
    }

    return new Response(
      JSON.stringify({
        eval_count: 23,
        prompt_eval_count: 21,
        response: "{\"intent\":\"search_profile\",\"targets\":[{\"name\":\"John Smith\"}],\"action\":{\"type\":\"open_profile\"}}"
      })
    );
  };

  const openai = await new OpenAiModelProvider("gpt-test", "openai_test").complete({
    system: "Parse",
    user: "Raw task: Search for John Smith"
  });

  assert.equal(JSON.parse(openai.text).targets[0].name, "John Smith");
  assert.deepEqual(openai.usage, {
    inputTokens: 11,
    outputTokens: 13
  });

  const anthropic = await new AnthropicModelProvider("claude-test", "anthropic_test").complete({
    system: "Parse",
    user: "Raw task: Search for John Smith"
  });

  assert.equal(JSON.parse(anthropic.text).action.type, "open_profile");
  assert.deepEqual(anthropic.usage, {
    inputTokens: 17,
    outputTokens: 19
  });

  const ollama = await new OllamaModelProvider("llama-test", "http://127.0.0.1:11434").complete({
    system: "Parse",
    user: "Raw task: Search for John Smith"
  });

  assert.equal(JSON.parse(ollama.text).intent, "search_profile");
  assert.deepEqual(ollama.usage, {
    inputTokens: 21,
    outputTokens: 23
  });

  const gemini = await new GeminiModelProvider("gemini-test", "gemini_test").complete({
    system: "Parse",
    user: "Raw task: Search for John Smith"
  });

  assert.equal(JSON.parse(gemini.text).targets[0].name, "John Smith");
  assert.deepEqual(gemini.usage, {
    inputTokens: 31,
    outputTokens: 29
  });
} finally {
  globalThis.fetch = originalFetch;
}
