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
  const candidateText = normalized.match(/^(?:search for|connect with|find)\s+(.+?)(?:\s+(?:at|from|and|with)\b|$)/i)?.[1] ?? normalized;
  const words = candidateText.match(/\b[A-Z][a-z]+\b/g) ?? [];

  return words.slice(0, 2).join(" ") || "John Smith";
}

function extractCompany(text: string) {
  return text.match(/\bat\s+([A-Z][A-Za-z0-9&.\- ]+?)(?=\s+(?:from|and|with|to)\b|$)/)?.[1]?.trim();
}

function extractSchool(text: string) {
  return text.match(/\bfrom\s+([A-Z][A-Za-z0-9&.\- ]+?)(?=\s+(?:and|with|to)\b|$)/)?.[1]?.trim();
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
            company: extractCompany(command),
            name: targetName,
            school: extractSchool(command)
          }
        ]
      })
    };
  }
}
