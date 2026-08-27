import type { ModelProvider, ModelRequest, ModelResponse } from "./provider.js";

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type PricedProvider = ModelProvider & {
  readonly id: string;
  readonly model: string;
  costForUsage(usage: ProviderUsage): number;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

type AnthropicResponse = {
  content?: Array<{
    text?: string;
    type?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

type OllamaResponse = {
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function price(inputTokens: number, outputTokens: number, inputPerMillion: number, outputPerMillion: number) {
  return (inputTokens / 1_000_000) * inputPerMillion + (outputTokens / 1_000_000) * outputPerMillion;
}

function extractOpenAiText(body: OpenAiResponse) {
  if (body.output_text) {
    return body.output_text;
  }

  return body.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("")
    .trim() ?? "";
}

export class OpenAiModelProvider implements PricedProvider {
  readonly id = "openai";

  constructor(
    readonly model = process.env.OPENAI_MODEL ?? "gpt-5.1",
    private readonly apiKey = requireEnv("OPENAI_API_KEY")
  ) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: request.user,
        instructions: request.system,
        max_output_tokens: 500,
        model: this.model,
        text: {
          format: {
            type: "text"
          }
        }
      }),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}: ${await response.text()}`);
    }

    const body = await response.json() as OpenAiResponse;

    return {
      text: extractOpenAiText(body),
      usage: {
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0
      }
    };
  }

  costForUsage(usage: ProviderUsage) {
    return price(usage.inputTokens, usage.outputTokens, 1.25, 10);
  }
}

export class AnthropicModelProvider implements PricedProvider {
  readonly id = "anthropic";

  constructor(
    readonly model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
    private readonly apiKey = requireEnv("ANTHROPIC_API_KEY")
  ) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      body: JSON.stringify({
        max_tokens: 500,
        messages: [
          {
            content: request.user,
            role: "user"
          }
        ],
        model: this.model,
        system: request.system
      }),
      headers: {
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "x-api-key": this.apiKey
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed with ${response.status}: ${await response.text()}`);
    }

    const body = await response.json() as AnthropicResponse;

    return {
      text: body.content?.map((content) => content.text ?? "").join("").trim() ?? "",
      usage: {
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0
      }
    };
  }

  costForUsage(usage: ProviderUsage) {
    return price(usage.inputTokens, usage.outputTokens, 3, 15);
  }
}

export class OllamaModelProvider implements PricedProvider {
  readonly id = "ollama";

  constructor(
    readonly model = process.env.OLLAMA_MODEL ?? "llama3.1:8b",
    private readonly baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"
  ) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      body: JSON.stringify({
        format: "json",
        model: this.model,
        options: {
          temperature: 0
        },
        prompt: request.user,
        stream: false,
        system: request.system
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with ${response.status}: ${await response.text()}`);
    }

    const body = await response.json() as OllamaResponse;

    return {
      text: body.response?.trim() ?? "",
      usage: {
        inputTokens: body.prompt_eval_count ?? 0,
        outputTokens: body.eval_count ?? 0
      }
    };
  }

  costForUsage(_usage: ProviderUsage) {
    return 0;
  }
}
