import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { stdout } from "node:process";
import { formatTaskChecklist, previewScenario, runPhase0Task } from "@yomeets/agent-core";
import {
  formatBenchmarkSummary,
  formatFaultBenchmarkSummary,
  formatEndToEndDemoSummary,
  formatModelBenchmarkSummary,
  formatSideEffectSafetySummary,
  runPhase1Benchmark,
  runPhase2FaultBenchmark,
  runPhase5EndToEndDemo,
  runPhase4ModelBenchmark,
  runPhase3SideEffectSafetyProof
} from "@yomeets/benchmark-phase1";
import { runMeetingPipeline, type MeetingIntegrationAdapter } from "@yomeets/meeting-engine";
import { GeminiModelProvider, LocalHeuristicModelProvider, OpenAiModelProvider, ScriptedModelProvider } from "@yomeets/model-router";
import { createApprovalRequest } from "@yomeets/policy-engine";
import { openStorage, runMigrations } from "@yomeets/storage";
import { normalizeTranscript } from "@yomeets/task-engine";
import { promptForApproval } from "./approval.js";

const host = "127.0.0.1";
const port = 47821;
const localApiUrl = `http://${host}:${port}`;

type Task = {
  id: string;
  command: string;
  createdAt: string;
  status: "queued";
};

const tasks = new Map<string, Task>();

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage) {
  let text = "";

  for await (const chunk of request) {
    text += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  }

  if (!text) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

function createTask(command: string): Task {
  const task = {
    id: randomUUID(),
    command,
    createdAt: new Date().toISOString(),
    status: "queued" as const
  };

  tasks.set(task.id, task);
  return task;
}

function commandFromRequestBody(body: unknown) {
  if (typeof body !== "object" || !body) {
    return undefined;
  }

  if ("command" in body && typeof body.command === "string") {
    return body.command.trim();
  }

  if ("transcript" in body && typeof body.transcript === "string") {
    return normalizeTranscript({ text: body.transcript }).command;
  }

  return undefined;
}

async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", localApiUrl);

  if (method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/tasks") {
    sendJson(response, 200, { tasks: [...tasks.values()] });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/tasks") {
    const body = await readJson(request);
    const command = commandFromRequestBody(body);

    if (!command) {
      sendJson(response, 400, { error: "command or transcript is required" });
      return;
    }

    sendJson(response, 202, { task: createTask(command) });
    return;
  }

  sendJson(response, 404, { error: "not found" });
}

function startServer() {
  const server = createServer((request, response) => {
    handleRequest(request, response).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, 500, { error: message });
    });
  });

  server.listen(port, host, () => {
    stdout.write(`YoMeets local API listening on ${localApiUrl}\n`);
  });
}

async function submitTask(command: string) {
  const response = await fetch(`${localApiUrl}/v1/tasks`, {
    body: JSON.stringify({ command }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  const body = await response.json() as { task?: Task; error?: string };

  if (!response.ok || !body.task) {
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  stdout.write(`Queued ${body.task.id}: ${body.task.command}\n`);
}

async function submitTranscript(text: string) {
  const transcript = normalizeTranscript({ text });
  const response = await fetch(`${localApiUrl}/v1/tasks`, {
    body: JSON.stringify({ transcript: transcript.rawText }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  const body = await response.json() as { task?: Task; error?: string };

  if (!response.ok || !body.task) {
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  stdout.write(`Queued transcript ${body.task.id}: ${body.task.command}\n`);
}

function readPreviewArgs(args: string[]) {
  const intentIndex = args.indexOf("--intent-json");

  if (intentIndex === -1 || !args[intentIndex + 1]) {
    throw new Error("preview requires --intent-json");
  }

  const command = [...args.slice(0, intentIndex), ...args.slice(intentIndex + 2)].join(" ").trim();

  if (!command) {
    throw new Error("preview command is required");
  }

  return {
    command,
    intentJson: args[intentIndex + 1]
  };
}

async function previewTask(args: string[]) {
  const { command, intentJson } = readPreviewArgs(args);
  const preview = await previewScenario(command, new ScriptedModelProvider([intentJson]));

  if (preview.status === "failed") {
    throw new Error(`${preview.reason}: ${preview.error}`);
  }

  stdout.write(`${preview.command}\n${formatTaskChecklist(preview.trace)}\n`);
}

async function runPhase0Command(command: string) {
  const storage = openStorage();

  runMigrations(storage);

  try {
    const result = await runPhase0Task(storage, new LocalHeuristicModelProvider(), command);

    stdout.write(`Task ${result.taskId}: ${result.status}\n`);
    stdout.write(`Verification: ${result.verificationPassed ? "passed" : "failed"}\n`);
    stdout.write(`${result.trace.join(" -> ")}\n`);
  } finally {
    storage.sqlite.close();
  }
}

async function runPhase1BenchmarkCommand() {
  const summary = await runPhase1Benchmark();

  stdout.write(`${formatBenchmarkSummary(summary)}\n`);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

async function runPhase2BenchmarkCommand() {
  const summary = await runPhase2FaultBenchmark();

  stdout.write(`${formatFaultBenchmarkSummary(summary)}\n`);
}

function runPhase3BenchmarkCommand() {
  const summary = runPhase3SideEffectSafetyProof();

  stdout.write(`${formatSideEffectSafetySummary(summary)}\n`);
}

async function runPhase4BenchmarkCommand() {
  const summary = await runPhase4ModelBenchmark();

  stdout.write(`${formatModelBenchmarkSummary(summary)}\n`);
}

function readRecordPath(args: string[]) {
  const index = args.indexOf("--record");

  if (index === -1) {
    return undefined;
  }

  if (!args[index + 1]) {
    throw new Error("demo phase5 --record requires a path");
  }

  return args[index + 1];
}

async function runPhase5DemoCommand(args: string[]) {
  const summary = await runPhase5EndToEndDemo({
    recordPath: readRecordPath(args)
  });

  stdout.write(`${formatEndToEndDemoSummary(summary)}\n`);
}

function hasFlag(args: string[], flag: string) {
  return args.includes(flag);
}

function modelProviderFromEnv() {
  if (process.env.GEMINI_API_KEY) {
    return new GeminiModelProvider();
  }

  if (process.env.OPENAI_API_KEY) {
    return new OpenAiModelProvider();
  }

  throw new Error("Set GEMINI_API_KEY or OPENAI_API_KEY to process a meeting transcript");
}

function dryRunIntegrations(): MeetingIntegrationAdapter {
  const results = new Map<string, unknown>();

  return {
    createDraft: async (action) => {
      const id = `dry_gmail_${results.size + 1}`;
      results.set(id, { id });
      return { externalId: id, provider: "gmail", raw: action };
    },
    createIssue: async (action) => {
      const id = `dry_github_${results.size + 1}`;
      results.set(id, { title: action.title });
      return { externalId: id, provider: "github", raw: action };
    },
    createOrUpdateEvent: async (action) => {
      const id = `dry_calendar_${results.size + 1}`;
      results.set(id, { start: { dateTime: action.newTime } });
      return { externalId: id, provider: "google_calendar", raw: action };
    },
    getDraft: async (id) => results.get(id) as { id?: string; message?: { id?: string } },
    getEvent: async (id) => results.get(id) as { start?: { dateTime?: string } },
    getIssue: async (id) => results.get(id) as { title?: string }
  };
}

async function processMeeting(args: string[]) {
  const filePath = args.find((arg) => !arg.startsWith("--"));

  if (!filePath) {
    throw new Error("process-meeting requires a transcript file path");
  }

  const storage = openStorage();
  const transcript = readFileSync(filePath, "utf8");

  runMigrations(storage);

  try {
    const result = await runMeetingPipeline(storage, {
      approve: async (request) => {
        const approval = await promptForApproval(request);

        return approval.status === "approved" ? "yes" : "no";
      },
      integrations: hasFlag(args, "--dry-run") ? dryRunIntegrations() : undefined,
      provider: modelProviderFromEnv(),
      title: filePath,
      transcript
    });

    stdout.write(`Meeting ${result.meetingId}\n`);
    stdout.write(`Commitments: ${result.commitments.length}\n`);

    for (const action of result.actions) {
      stdout.write(`${action.status}: ${action.action.type}`);

      if (action.externalId) {
        stdout.write(` -> ${action.externalId}`);
      }

      stdout.write("\n");
    }
  } finally {
    storage.sqlite.close();
  }
}

async function approveTask(args: string[]) {
  const [taskId, ...labelParts] = args;
  const label = labelParts.join(" ").trim();

  if (!taskId || !label) {
    throw new Error("approve requires a task id and action label");
  }

  const request = createApprovalRequest(`approval_${taskId}`, taskId, {
    prompt: `Approve external action: ${label}?`,
    riskLevel: "external_side_effect",
    status: "approval_required"
  });
  const decided = await promptForApproval(request);

  stdout.write(`${decided.id}: ${decided.status}\n`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "serve") {
    startServer();
    return;
  }

  if (command === "run" && args.join(" ").trim()) {
    await submitTask(args.join(" ").trim());
    return;
  }

  if (command === "transcript" && args.join(" ").trim()) {
    await submitTranscript(args.join(" ").trim());
    return;
  }

  if (command === "phase0" && args.join(" ").trim()) {
    await runPhase0Command(args.join(" ").trim());
    return;
  }

  if (command === "benchmark" && args[0] === "phase1") {
    await runPhase1BenchmarkCommand();
    return;
  }

  if (command === "benchmark" && args[0] === "phase2") {
    await runPhase2BenchmarkCommand();
    return;
  }

  if (command === "benchmark" && args[0] === "phase3") {
    runPhase3BenchmarkCommand();
    return;
  }

  if (command === "benchmark" && args[0] === "phase4") {
    await runPhase4BenchmarkCommand();
    return;
  }

  if (command === "demo" && args[0] === "phase5") {
    await runPhase5DemoCommand(args.slice(1));
    return;
  }

  if (command === "process-meeting") {
    await processMeeting(args);
    return;
  }

  if (command === "preview") {
    await previewTask(args);
    return;
  }

  if (command === "approve") {
    await approveTask(args);
    return;
  }

  stdout.write("Usage:\n  yomeets serve\n  yomeets run \"Find meeting follow-ups\"\n  yomeets transcript \"Find meeting follow-ups\"\n  yomeets phase0 \"Find John Smith at Google and send a connection request with 'Hello John.'\"\n  yomeets benchmark phase1\n  yomeets benchmark phase2\n  yomeets benchmark phase3\n  yomeets benchmark phase4\n  yomeets demo phase5 --record artifacts/phase5-demo.cast\n  yomeets process-meeting notes.txt --dry-run\n  yomeets preview \"Find John Smith\" --intent-json '{...}'\n  yomeets approve <taskId> \"Send connection request\"\n");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    stdout.write(`Failed: ${message}\n`);
    process.exitCode = 1;
  });
