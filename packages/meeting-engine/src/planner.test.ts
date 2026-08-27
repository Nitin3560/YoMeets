import assert from "node:assert/strict";
import { planCommitments } from "./planner.js";
import type { Commitment } from "./types.js";

const base = {
  confidence: 0.9,
  deadline: null,
  id: "commitment_1",
  owner: "Nitin",
  sourceQuote: "Nitin will investigate the API timeout.",
  timestamp: "sentence 1"
};

const actions = planCommitments([
  {
    ...base,
    actionType: "create_issue",
    description: "Investigate the API timeout"
  },
  {
    ...base,
    actionType: "schedule_event",
    deadline: "2026-09-07T10:00:00-05:00",
    description: "Move the customer sync"
  },
  {
    ...base,
    actionType: "send_email",
    description: "Send the migration note to Leo"
  },
  {
    ...base,
    actionType: "record_decision",
    description: "Keep OAuth scopes minimal"
  }
] satisfies Commitment[]);

assert.equal(actions[0]?.type, "github_issue");
assert.equal(actions[0]?.type === "github_issue" ? actions[0].assignee : undefined, "Nitin");
assert.equal(actions[1]?.type === "calendar_update" ? actions[1].newTime : undefined, "2026-09-07T10:00:00-05:00");
assert.equal(actions[2]?.type === "gmail_draft" ? actions[2].to : undefined, "Leo");
assert.equal(actions[3]?.type === "record_decision" ? actions[3].text : undefined, "Keep OAuth scopes minimal");
