import assert from "node:assert/strict";
import { GitHubIntegration } from "./github.js";

const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.github.com/repos/Nitin3560/YoMeets/issues");
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer gh_test");
    assert.equal((init?.headers as Record<string, string>)["X-GitHub-Api-Version"], "2022-11-28");

    const body = JSON.parse(String(init?.body));

    assert.deepEqual(body.assignees, ["nitin"]);
    assert.equal(body.title, "Investigate ingestion failures");

    return new Response(JSON.stringify({
      html_url: "https://github.com/Nitin3560/YoMeets/issues/42",
      number: 42
    }));
  };

  const result = await new GitHubIntegration({ token: "gh_test" }).createIssue({
    assignee: "nitin",
    body: "Meeting context",
    owner: "Nitin3560",
    repo: "YoMeets",
    title: "Investigate ingestion failures"
  });

  assert.equal(result.provider, "github");
  assert.equal(result.externalId, "42");
  assert.equal(result.url, "https://github.com/Nitin3560/YoMeets/issues/42");
} finally {
  globalThis.fetch = originalFetch;
}
