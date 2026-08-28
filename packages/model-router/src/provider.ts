export type ModelRequest = {
  system: string;
  user: string;
};

export type ModelResponse = {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
};

export type ModelProvider = {
  complete(request: ModelRequest): Promise<ModelResponse>;
};

export type EmbeddingProvider = {
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
};

export class ScriptedModelProvider implements ModelProvider {
  private index = 0;

  constructor(private readonly responses: string[]) {}

  async complete(): Promise<ModelResponse> {
    const text = this.responses[this.index];
    this.index += 1;

    if (text === undefined) {
      throw new Error("No scripted model response available");
    }

    return { text };
  }
}
