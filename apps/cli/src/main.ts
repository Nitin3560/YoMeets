import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { stdout } from "node:process";
import { formatTaskChecklist, previewScenario } from "@yomeets/agent-core";
import { ScriptedModelProvider } from "@yomeets/model-router";

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
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
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
    const command = typeof body === "object" && body && "command" in body ? body.command : undefined;

    if (typeof command !== "string" || command.trim().length === 0) {
      sendJson(response, 400, { error: "command is required" });
      return;
    }

    sendJson(response, 202, { task: createTask(command.trim()) });
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

  if (command === "preview") {
    await previewTask(args);
    return;
  }

  stdout.write("Usage:\n  yomeets serve\n  yomeets run \"Find meeting follow-ups\"\n  yomeets preview \"Find John Smith\" --intent-json '{...}'\n");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    stdout.write(`Failed: ${message}\n`);
    process.exitCode = 1;
  });
