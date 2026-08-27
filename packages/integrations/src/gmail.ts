import { postJson, requireEnv, type AuthConfig, type IntegrationResult } from "./http.js";

export type CreateGmailDraftInput = {
  userId?: string;
  to: string;
  subject: string;
  body: string;
};

type GmailDraftResponse = {
  id?: string;
  message?: {
    id?: string;
  };
};

function base64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function mimeMessage(input: CreateGmailDraftInput) {
  return [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.body
  ].join("\r\n");
}

export class GmailIntegration {
  constructor(private readonly auth: AuthConfig = { token: requireEnv("GOOGLE_ACCESS_TOKEN") }) {}

  async createDraft(input: CreateGmailDraftInput): Promise<IntegrationResult> {
    const userId = encodeURIComponent(input.userId ?? "me");
    const draft = await postJson<GmailDraftResponse>(`https://gmail.googleapis.com/gmail/v1/users/${userId}/drafts`, {
      Authorization: `Bearer ${this.auth.token}`
    }, {
      message: {
        raw: base64Url(mimeMessage(input))
      }
    });

    return {
      externalId: draft.id ?? draft.message?.id ?? "",
      provider: "gmail",
      raw: draft
    };
  }
}
