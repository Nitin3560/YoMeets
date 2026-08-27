import assert from "node:assert/strict";
import { GmailIntegration } from "./gmail.js";

const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://gmail.googleapis.com/gmail/v1/users/me/drafts");
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer google_test");

    const body = JSON.parse(String(init?.body));
    const raw = Buffer.from(body.message.raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

    assert.match(raw, /To: sarah@example.com/);
    assert.match(raw, /Subject: Benchmark results/);

    return new Response(JSON.stringify({
      id: "draft_1"
    }));
  };

  const result = await new GmailIntegration({ token: "google_test" }).createDraft({
    body: "Here are the benchmark results.",
    subject: "Benchmark results",
    to: "sarah@example.com"
  });

  assert.equal(result.provider, "gmail");
  assert.equal(result.externalId, "draft_1");
} finally {
  globalThis.fetch = originalFetch;
}
