import type { EmbeddingProvider, ModelProvider, ModelRequest, ModelResponse } from "./provider.js";

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

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

type GeminiEmbeddingResponse = {
  embedding?: {
    values?: number[];
  };
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

export class GeminiModelProvider implements PricedProvider {
  readonly id = "gemini";

  constructor(
    readonly model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
    private readonly apiKey = requireEnv("GEMINI_API_KEY")
  ) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`);

    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url, {
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: request.user
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0
        },
        systemInstruction: {
          parts: [
            {
              text: request.system
            }
          ]
        }
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with ${response.status}: ${await response.text()}`);
    }

    const body = await response.json() as GeminiResponse;

    return {
      text: body.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? "").join("").trim() ?? "",
      usage: {
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0
      }
    };
  }

  costForUsage(usage: ProviderUsage) {
    return price(usage.inputTokens, usage.outputTokens, 0.3, 2.5);
  }
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions: number;

  constructor(
    readonly model = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2",
    private readonly apiKey = requireEnv("GEMINI_API_KEY"),
    dimensions = Number.parseInt(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? "768", 10)
  ) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent`);

    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url, {
      body: JSON.stringify({
        content: {
          parts: [{ text }]
        },
        embedContentConfig: {
          outputDimensionality: this.dimensions,
          taskType: "RETRIEVAL_DOCUMENT"
        }
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`Gemini embedding request failed with ${response.status}: ${await response.text()}`);
    }

    const body = await response.json() as GeminiEmbeddingResponse;
    const values = body.embedding?.values;

    if (!values || values.length === 0) {
      throw new Error("Gemini embedding response did not include values");
    }

    return values;
  }
}
