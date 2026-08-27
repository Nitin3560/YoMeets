import assert from "node:assert/strict";
import { executePlannedMeetingAction, verifyPlannedMeetingAction } from "./executor.js";

const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes("api.github.com")) {
      if (init?.method === "GET") {
        return new Response(JSON.stringify({ assignees: [{ login: "nitin" }], number: 7, title: "Investigate ingestion" }));
      }

      return new Response(JSON.stringify({ number: 7 }));
    }

    if (url.includes("calendar")) {
      assert.equal(init?.method, "PATCH");
      return new Response(JSON.stringify({ id: "calendar_1" }));
    }

    return new Response(JSON.stringify({ id: "draft_1" }));
  };

  process.env.GITHUB_TOKEN = "gh_test";
  process.env.GOOGLE_ACCESS_TOKEN = "google_test";

  const githubAction = {
    commitmentId: "c1",
    id: "a1",
    input: {
      assignee: "nitin",
      body: "Investigate failed jobs",
      title: "Investigate ingestion"
    },
    label: "Create issue",
    requiresApproval: true,
    type: "github.create_issue"
  } as const;
  const github = await executePlannedMeetingAction(githubAction, {
    githubOwner: "Nitin3560",
    githubRepo: "YoMeets"
  });
  const githubVerification = await verifyPlannedMeetingAction(githubAction, github, {
    githubOwner: "Nitin3560",
    githubRepo: "YoMeets"
  });

  const memory = await executePlannedMeetingAction({
    commitmentId: "c2",
    id: "a2",
    input: {
      decision: "Use Redis"
    },
    label: "Record decision",
    requiresApproval: false,
    type: "memory.record_decision"
  });

  assert.equal(github.provider, "github");
  assert.equal(githubVerification.passed, true);
  assert.equal(memory.provider, "memory");
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.GITHUB_TOKEN;
  delete process.env.GOOGLE_ACCESS_TOKEN;
}
