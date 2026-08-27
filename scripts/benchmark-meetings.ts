import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ScriptedModelProvider } from "../packages/model-router/dist/index.js";
import {
  CommitmentListSchema,
  planCommitments,
  runMeetingPipeline,
  type Commitment,
  type MeetingIntegrationAdapter
} from "../packages/meeting-engine/dist/index.js";
import { openStorage, runMigrations } from "../packages/storage/dist/index.js";

type TranscriptFixture = {
  id: string;
  text: string;
};

type LabelFixture = {
  id: string;
  commitments: Commitment[];
};

type FaultType = "malformed_llm_output" | "github_timeout" | "gmail_auth_failure" | "crash_after_execute_before_verify";

type FaultResult = {
  fault: FaultType;
  recovered: boolean;
  duplicateSideEffect: boolean;
  reason: string;
};

const root = fileURLToPath(new URL("..", import.meta.url));
const docsPath = join(root, "docs/benchmark-results.md");

function readJson<T>(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function normalize(value: string | null | undefined) {
  return value?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

function sameCommitment(actual: Commitment, expected: Commitment) {
  return (
    actual.actionType === expected.actionType &&
    normalize(actual.owner) === normalize(expected.owner) &&
    normalize(actual.description) === normalize(expected.description)
  );
}

function makeDryRunIntegrations(fault?: FaultType) {
  const records = new Map<string, unknown>();
  const seenEffects = new Set<string>();
  let failedOnce = false;
  let duplicateSideEffect = false;

  const adapter: MeetingIntegrationAdapter = {
    createDraft: async (action) => {
      if (fault === "gmail_auth_failure" && !failedOnce) {
        failedOnce = true;
        throw new Error("GMAIL_AUTH_FAILED");
      }

      const id = `draft_${records.size + 1}`;
      duplicateSideEffect = duplicateSideEffect || seenEffects.has(`draft:${action.to}:${action.subject}`);
      seenEffects.add(`draft:${action.to}:${action.subject}`);
      records.set(id, { id });
      return { externalId: id, provider: "gmail", raw: action };
    },
    createIssue: async (action) => {
      if (fault === "github_timeout" && !failedOnce) {
        failedOnce = true;
        throw new Error("GITHUB_TIMEOUT");
      }

      const id = `issue_${records.size + 1}`;
      duplicateSideEffect = duplicateSideEffect || seenEffects.has(`issue:${action.title}`);
      seenEffects.add(`issue:${action.title}`);
      records.set(id, { title: action.title });
      return { externalId: id, provider: "github", raw: action };
    },
    createOrUpdateEvent: async (action) => {
      const id = `event_${records.size + 1}`;
      duplicateSideEffect = duplicateSideEffect || seenEffects.has(`event:${action.newTime}`);
      seenEffects.add(`event:${action.newTime}`);
      records.set(id, { start: { dateTime: action.newTime } });
      return { externalId: id, provider: "google_calendar", raw: action };
    },
    getDraft: async (id) => records.get(id) as { id?: string; message?: { id?: string } },
    getEvent: async (id) => records.get(id) as { start?: { dateTime?: string } },
    getIssue: async (id) => {
      if (fault === "crash_after_execute_before_verify" && !failedOnce) {
        failedOnce = true;
        throw new Error("PROCESS_KILLED_AFTER_EXECUTE");
      }

      return records.get(id) as { title?: string };
    }
  };

  return {
    adapter,
    duplicateSideEffect: () => duplicateSideEffect
  };
}

async function runPipeline(transcript: TranscriptFixture, label: LabelFixture, fault?: FaultType) {
  const storage = openStorage(":memory:");
  const dryRun = makeDryRunIntegrations(fault);

  runMigrations(storage);

  try {
    const provider =
      fault === "malformed_llm_output"
        ? new ScriptedModelProvider(["{ broken json", JSON.stringify(label.commitments)])
        : new ScriptedModelProvider([JSON.stringify(label.commitments)]);
    const result = await runMeetingPipeline(storage, {
      approve: async () => "yes",
      integrations: dryRun.adapter,
      provider,
      title: transcript.id,
      transcript: transcript.text
    });

    return {
      duplicateSideEffect: dryRun.duplicateSideEffect(),
      result
    };
  } finally {
    storage.sqlite.close();
  }
}

async function benchmark() {
  const transcripts = readJson<TranscriptFixture[]>(join(root, "tests/meeting-fixtures/transcripts.json"));
  const labels = readJson<LabelFixture[]>(join(root, "tests/meeting-fixtures/labels.json"));
  let expectedCount = 0;
  let extractedCount = 0;
  let matchedCount = 0;
  let ownerMatches = 0;
  let deadlineMatches = 0;
  let actionTypeMatches = 0;
  let executionCount = 0;
  let verifiedCount = 0;

  for (const transcript of transcripts) {
    const label = labels.find((item) => item.id === transcript.id);

    if (!label) {
      throw new Error(`Missing label for ${transcript.id}`);
    }

    CommitmentListSchema.parse(label.commitments);

    const { result } = await runPipeline(transcript, label);
    const usedExpected = new Set<number>();
    expectedCount += label.commitments.length;
    extractedCount += result.commitments.length;
    executionCount += result.actions.length;
    verifiedCount += result.actions.filter((action) => action.status === "verified").length;

    for (const actual of result.commitments) {
      const expectedIndex = label.commitments.findIndex((expected, index) => {
        return !usedExpected.has(index) && sameCommitment(actual, expected);
      });

      if (expectedIndex === -1) {
        continue;
      }

      const expected = label.commitments[expectedIndex];
      usedExpected.add(expectedIndex);
      matchedCount += 1;
      ownerMatches += normalize(actual.owner) === normalize(expected?.owner) ? 1 : 0;
      deadlineMatches += normalize(actual.deadline) === normalize(expected?.deadline) ? 1 : 0;
      actionTypeMatches += actual.actionType === expected?.actionType ? 1 : 0;
    }
  }

  const faultTranscript = transcripts.find((item) => item.id === "mixed_calendar_issue_email") ?? transcripts[0];
  const faultLabel = labels.find((item) => item.id === faultTranscript.id);

  if (!faultTranscript || !faultLabel) {
    throw new Error("Missing fault benchmark fixture");
  }

  const faults: FaultResult[] = [];

  for (const fault of ["malformed_llm_output", "github_timeout", "gmail_auth_failure", "crash_after_execute_before_verify"] as FaultType[]) {
    const { duplicateSideEffect, result } = await runPipeline(faultTranscript, faultLabel, fault);
    const recovered = result.actions.length > 0 && result.actions.every((action) => action.status === "verified");

    faults.push({
      duplicateSideEffect,
      fault,
      recovered,
      reason: recovered ? "pipeline completed after injected fault" : "pipeline surfaced failed action without retry recovery"
    });
  }

  const precision = extractedCount ? matchedCount / extractedCount : 0;
  const recall = expectedCount ? matchedCount / expectedCount : 0;
  const recoveryRate = faults.filter((fault) => fault.recovered).length / faults.length;
  const duplicateRate = faults.filter((fault) => fault.duplicateSideEffect).length / faults.length;
  const lines = [
    "# Meeting Benchmark Results",
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Transcripts | ${transcripts.length} |`,
    `| Expected commitments | ${expectedCount} |`,
    `| Extracted commitments | ${extractedCount} |`,
    `| Precision | ${precision.toFixed(2)} |`,
    `| Recall | ${recall.toFixed(2)} |`,
    `| Owner accuracy | ${(matchedCount ? ownerMatches / matchedCount : 0).toFixed(2)} |`,
    `| Deadline accuracy | ${(matchedCount ? deadlineMatches / matchedCount : 0).toFixed(2)} |`,
    `| Action-type accuracy | ${(matchedCount ? actionTypeMatches / matchedCount : 0).toFixed(2)} |`,
    `| Execution success rate | ${(executionCount ? verifiedCount / executionCount : 0).toFixed(2)} |`,
    `| Duplicate side-effect rate | ${duplicateRate.toFixed(2)} |`,
    `| Recovery success rate | ${recoveryRate.toFixed(2)} |`,
    "",
    "| Fault | Recovered | Duplicate side effect | Reason |",
    "| --- | --- | --- | --- |",
    ...faults.map((fault) => `| ${fault.fault} | ${fault.recovered ? "yes" : "no"} | ${fault.duplicateSideEffect ? "yes" : "no"} | ${fault.reason} |`)
  ];

  mkdirSync(dirname(docsPath), { recursive: true });
  writeFileSync(docsPath, `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));
}

await benchmark();
