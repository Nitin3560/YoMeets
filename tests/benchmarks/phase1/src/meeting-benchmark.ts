import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { runMeetingExecution } from "@yomeets/agent-core";
import { openStorage, runMigrations } from "@yomeets/storage";
import {
  extractMeetingCommitments,
  planMeetingCommitments,
  type MeetingCommitment,
  type PlannedMeetingAction
} from "@yomeets/task-engine";

export type MeetingBenchmarkCase = {
  id: string;
  transcript: string;
  expected: MeetingCommitment[];
};

export type MeetingBenchmarkMetrics = {
  totalTranscripts: number;
  expectedCommitments: number;
  extractedCommitments: number;
  precision: number;
  recall: number;
  ownerAccuracy: number;
  deadlineAccuracy: number;
  executionSuccessRate: number;
  duplicateSideEffectRate: number;
  recoverySuccessRate: number;
  humanCorrectionRate: number;
  latencyMs: number;
};

const owners = ["Nitin", "Sarah", "Priya", "Marco", "Ava", "Leo"];
const subjects = [
  "the failed ingestion jobs",
  "the billing webhook retries",
  "the onboarding checklist",
  "the flaky calendar sync",
  "the release blocker",
  "the customer export bug"
];
const recipients = ["Sarah", "Priya", "Marco", "Ava", "Leo", "Nitin"];
const dueDates = ["Friday", "Monday morning", "tomorrow", "next Tuesday", "August 30", "end of week"];

function commitment(id: string, type: MeetingCommitment["type"], owner: string, subject: string, due: string): MeetingCommitment {
  if (type === "investigation") {
    return {
      due,
      id,
      owner,
      subject,
      summary: `${owner} will investigate ${subject}`,
      type
    };
  }

  if (type === "schedule_change") {
    return {
      due,
      id,
      owner,
      subject,
      summary: `${owner} will move ${subject} to ${due}`,
      type
    };
  }

  if (type === "follow_up_message") {
    const recipient = recipients[Number(id.split("_").at(-1) ?? 0) % recipients.length];

    return {
      due,
      id,
      owner,
      recipient,
      subject,
      summary: `${owner} will send ${subject} to ${recipient}`,
      type
    };
  }

  return {
    id,
    summary: `keep ${subject} documented`,
    type
  };
}

export function buildMeetingBenchmarkCases(count = 60): MeetingBenchmarkCase[] {
  return Array.from({ length: count }, (_, index) => {
    const owner = owners[index % owners.length];
    const subject = subjects[index % subjects.length];
    const due = dueDates[index % dueDates.length];
    const type = ["investigation", "schedule_change", "follow_up_message", "decision_record"][
      index % 4
    ] as MeetingCommitment["type"];
    const id = `meeting_case_${index + 1}`;
    const expected = commitment(`expected_${index + 1}`, type, owner, subject, due);
    const actionSentence =
      type === "investigation"
        ? `${owner} will investigate ${subject} by ${due}.`
        : type === "schedule_change"
          ? `${owner} will move ${subject} to ${due}.`
          : type === "follow_up_message"
            ? `${owner} will send ${subject} to ${expected.recipient} by ${due}.`
            : `We decided to ${expected.summary}.`;

    return {
      expected: [expected],
      id,
      transcript: [
        "Quick meeting notes: the team reviewed open work and skipped two unrelated ideas.",
        actionSentence,
        "There was also chatter about lunch and dashboard colors."
      ].join(" ")
    };
  });
}

function normalize(value: string | undefined) {
  return value?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

function matchCommitment(extracted: MeetingCommitment, expected: MeetingCommitment) {
  return (
    extracted.type === expected.type &&
    normalize(extracted.summary) === normalize(expected.summary) &&
    normalize(extracted.owner) === normalize(expected.owner)
  );
}

function approvalMap(actions: PlannedMeetingAction[]) {
  return Object.fromEntries(
    actions.filter((action) => action.requiresApproval).map((action) => [action.id, "yes" as const])
  );
}

export async function runMeetingBenchmark(cases = buildMeetingBenchmarkCases()): Promise<MeetingBenchmarkMetrics> {
  const started = performance.now();
  const storage = openStorage(join(mkdtempSync(join(tmpdir(), "yomeets-meeting-benchmark-")), "benchmark.sqlite"));
  const sideEffects = new Set<string>();
  let duplicateSideEffects = 0;
  let extractedCount = 0;
  let expectedCount = 0;
  let matchedCount = 0;
  let ownerMatches = 0;
  let deadlineMatches = 0;
  let executable = 0;
  let executed = 0;

  runMigrations(storage);

  try {
    for (const item of cases) {
      const extraction = extractMeetingCommitments(item.transcript);
      const plan = planMeetingCommitments(extraction.commitments);
      const expectedMatches = new Set<number>();
      extractedCount += extraction.commitments.length;
      expectedCount += item.expected.length;
      executable += plan.actions.length;

      for (const extracted of extraction.commitments) {
        const expectedIndex = item.expected.findIndex((expected, index) => {
          return !expectedMatches.has(index) && matchCommitment(extracted, expected);
        });

        if (expectedIndex >= 0) {
          const expected = item.expected[expectedIndex];
          expectedMatches.add(expectedIndex);
          matchedCount += 1;
          ownerMatches += normalize(extracted.owner) === normalize(expected?.owner) ? 1 : 0;
          deadlineMatches += normalize(extracted.due) === normalize(expected?.due) ? 1 : 0;
        }
      }

      const result = await runMeetingExecution(storage, {
        approvals: approvalMap(plan.actions),
        commitments: extraction.commitments,
        execute: async (action) => {
          if (sideEffects.has(`${item.id}:${action.id}`)) {
            duplicateSideEffects += 1;
          }

          sideEffects.add(`${item.id}:${action.id}`);
          executed += 1;

          return {
            externalId: `${item.id}:${action.id}`,
            provider: action.type.startsWith("github")
              ? "github"
              : action.type.startsWith("calendar")
                ? "google_calendar"
                : action.type.startsWith("gmail")
                  ? "gmail"
                  : "memory",
            raw: action.input
          };
        },
        title: item.id,
        transcript: item.transcript,
        verify: async (_action, result) => ({
          observed: result.raw,
          passed: Boolean(result.externalId)
        })
      });

      if (result.executions.some((execution) => execution.status === "verification_failed")) {
        duplicateSideEffects += 1;
      }
    }
  } finally {
    storage.sqlite.close();
  }

  return {
    deadlineAccuracy: matchedCount ? deadlineMatches / matchedCount : 0,
    duplicateSideEffectRate: executed ? duplicateSideEffects / executed : 0,
    executionSuccessRate: executable ? executed / executable : 0,
    expectedCommitments: expectedCount,
    extractedCommitments: extractedCount,
    humanCorrectionRate: 0,
    latencyMs: Math.round(performance.now() - started),
    ownerAccuracy: matchedCount ? ownerMatches / matchedCount : 0,
    precision: extractedCount ? matchedCount / extractedCount : 0,
    recall: expectedCount ? matchedCount / expectedCount : 0,
    recoverySuccessRate: 0,
    totalTranscripts: cases.length
  };
}
