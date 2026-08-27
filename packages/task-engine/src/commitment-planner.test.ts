import assert from "node:assert/strict";
import { planMeetingCommitments } from "./commitment-planner.js";

const plan = planMeetingCommitments([
  {
    context: "Ingestion jobs are failing after the worker deploy.",
    due: "Friday",
    id: "c1",
    owner: "Nitin",
    subject: "ingestion job failures",
    summary: "Nitin will investigate why ingestion jobs are failing.",
    type: "investigation"
  },
  {
    due: "Friday 2 PM",
    id: "c2",
    subject: "deployment review",
    summary: "Move the deployment review to Friday.",
    type: "schedule_change"
  },
  {
    id: "c3",
    recipient: "Sarah",
    subject: "updated design document",
    summary: "Send Sarah the updated design document.",
    type: "follow_up_message"
  },
  {
    context: "Redis has TTL support and the team knows its ops model.",
    id: "c4",
    summary: "Use Redis for caching.",
    type: "decision_record"
  }
]);

assert.deepEqual(
  plan.actions.map((action) => action.type),
  ["github.create_issue", "calendar.update_event", "gmail.create_draft", "memory.record_decision"]
);
assert.equal(plan.actions[0]?.input.assignee, "Nitin");
assert.equal(plan.actions[0]?.input.title, "Investigate ingestion job failures");
assert.equal(plan.actions[1]?.input.newTime, "Friday 2 PM");
assert.equal(plan.actions[2]?.input.recipient, "Sarah");
assert.equal(plan.actions[2]?.requiresApproval, true);
assert.equal(plan.actions[3]?.requiresApproval, false);
