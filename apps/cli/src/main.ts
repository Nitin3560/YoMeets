import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { stdout } from "node:process";
import { formatTaskChecklist, previewScenario, runPhase0Task } from "@yomeets/agent-core";
import { formatBenchmarkSummary, runPhase1Benchmark } from "@yomeets/benchmark-phase1";
import { LocalHeuristicModelProvider, ScriptedModelProvider } from "@yomeets/model-router";
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

  if (command === "preview") {
    await previewTask(args);
    return;
  }

  if (command === "approve") {
    await approveTask(args);
    return;
  }

  stdout.write("Usage:\n  yomeets serve\n  yomeets run \"Find meeting follow-ups\"\n  yomeets transcript \"Find meeting follow-ups\"\n  yomeets phase0 \"Find John Smith at Google and send a connection request with 'Hello John.'\"\n  yomeets benchmark phase1\n  yomeets preview \"Find John Smith\" --intent-json '{...}'\n  yomeets approve <taskId> \"Send connection request\"\n");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    stdout.write(`Failed: ${message}\n`);
    process.exitCode = 1;
  });
