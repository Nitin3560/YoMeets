import assert from "node:assert/strict";
import { createIssue } from "./github.js";
import { createDraft } from "./gmail.js";
import { createOrUpdateEvent } from "./google-calendar.js";
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

  const directIssue = await createIssue({
    body: "Body",
    owner: "Nitin3560",
    repo: "YoMeets",
    title: "Investigate ingestion"
  }, {
    token: "gh_test"
  });
  const directEvent = await createOrUpdateEvent({
    calendarId: "primary",
    description: "Move review",
    end: "2026-09-04T16:00:00-05:00",
    eventId: "calendar_1",
    start: "2026-09-04T15:00:00-05:00",
    summary: "Review"
  }, {
    token: "google_test"
  });
  const directDraft = await createDraft({
    body: "Hello",
    subject: "Follow up",
    to: "sarah@example.com"
  }, {
    token: "google_test"
  });

  assert.equal(directIssue.provider, "github");
  assert.equal(directEvent.provider, "google_calendar");
  assert.equal(directDraft.provider, "gmail");
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.GITHUB_TOKEN;
  delete process.env.GOOGLE_ACCESS_TOKEN;
}
