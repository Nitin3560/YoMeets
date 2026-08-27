import type { ModelProvider, ModelRequest, ModelResponse } from "./provider.js";

function extractMessage(text: string) {
  const singleQuoted = text.match(/'([^']+)'/);

  if (singleQuoted?.[1]) {
    return singleQuoted[1];
  }

  const withText = text.match(/with\s+(.+)$/i);

  return withText?.[1]?.replace(/^["']|["']$/g, "").trim();
}

function extractTarget(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const candidateText = normalized.replace(/^(?:search for|connect with|find)\s+/i, "");
  const words = candidateText.match(/\b[A-Z][a-z]+\b/g) ?? [];

  return words.slice(0, 2).join(" ") || "John Smith";
}

export class LocalHeuristicModelProvider implements ModelProvider {
  async complete(request: ModelRequest): Promise<ModelResponse> {
    const command = request.user.replace(/^Raw task:\s*/i, "");
    const wantsConnect = /connect|connection request|send/i.test(command);
    const targetName = extractTarget(command);
    const message = wantsConnect ? extractMessage(command) : undefined;

    return {
      text: JSON.stringify({
        action: {
          ...(message ? { message } : {}),
          type: wantsConnect ? "connect" : "open_profile"
        },
        intent: wantsConnect ? "send_connection_request" : "search_profile",
        targets: [
          {
            company: /google/i.test(command) ? "Google" : undefined,
            name: targetName,
            school: /uta/i.test(command) ? "UTA" : undefined
          }
        ]
      })
    };
  }
}
