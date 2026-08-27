import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { checkpointForFailure } from "@yomeets/agent-core";
import { classifyFailure, decideRetry } from "@yomeets/agent-core";
import { verifyOutcome, type PageObservation } from "@yomeets/browser-core";
import { LocalHeuristicModelProvider, type ModelProvider, type ModelRequest, type ModelResponse } from "@yomeets/model-router";
import {
  ActionRepository,
  AuditWriter,
  TaskIntentRepository,
  TaskPlanRepository,
  TaskRepository,
  VerificationResultRepository,
  openStorage,
  runMigrations,
  type Storage
} from "@yomeets/storage";
import { createTaskFromCommand, parseTaskIntentWithModel, planTaskIntent, type TaskIntent } from "@yomeets/task-engine";
import { benchmarkTasks, type BenchmarkExpectation, type BenchmarkTask } from "./tasks.js";
import { fakeProfiles, type FakeProfile } from "./profiles.js";

export type BenchmarkTaskResult = {
  id: string;
  status: "passed" | "failed";
  attempts: number;
  latencyMs: number;
  failureReason?: string;
};

export type BenchmarkSummary = {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: BenchmarkTaskResult[];
};

export type FaultType =
  | "dom_missing_element"
  | "dom_stale_element"
  | "network_timeout"
  | "extension_disconnect"
  | "malformed_model_json"
  | "partial_side_effect"
  | "duplicate_action";

export type FaultRunResult = {
  fault: FaultType;
  recovered: number;
  total: number;
  recoveryRate: number;
  caughtBy: string;
  outcome: "recovered" | "failed" | "corrupted";
};

export type FaultBenchmarkSummary = {
  faults: FaultRunResult[];
};

type SiteState = Map<string, FakeProfile["status"]>;

type SimulationResult = {
  status: "completed" | "failed";
  siteStatus?: FakeProfile["status"];
  failureReason?: string;
  observation: PageObservation;
};

type TaskAttemptResult = {
  checkFailure?: string;
  failureCode?: string;
};

type FaultState = {
  fault?: FaultType;
  injected: boolean;
};

class FaultyModelProvider implements ModelProvider {
  private malformedReturned = false;

  constructor(private readonly inner: ModelProvider, private readonly fault?: FaultType) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    if (this.fault === "malformed_model_json" && !this.malformedReturned) {
      this.malformedReturned = true;
      return { text: "{ broken json" };
    }

    return this.inner.complete(request);
  }
}

function createSiteState() {
  return new Map(fakeProfiles.map((profile) => [profile.id, profile.status]));
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function findCandidates(intent: TaskIntent) {
  const target = intent.targets[0];
  const name = normalize(target.name);
  const company = target.company ? normalize(target.company) : undefined;
  const school = target.school ? normalize(target.school) : undefined;

  return fakeProfiles.filter((profile) => {
    return (
      normalize(profile.name) === name &&
      (!company || normalize(profile.company).includes(company)) &&
      (!school || normalize(profile.school).includes(school))
    );
  });
}

function profileObservation(profile: FakeProfile, status: FakeProfile["status"]): PageObservation {
  return {
    elements: [
      { bounds: { height: 32, width: 220, x: 0, y: 0 }, enabled: true, name: profile.name, ref: "name", role: "heading", visible: true },
      { bounds: { height: 24, width: 160, x: 0, y: 40 }, enabled: true, name: profile.company, ref: "company", role: "section", visible: true },
      { bounds: { height: 24, width: 160, x: 0, y: 72 }, enabled: true, name: profile.school, ref: "school", role: "section", visible: true },
      { bounds: { height: 24, width: 120, x: 0, y: 104 }, enabled: true, name: status, ref: "status", role: "status", visible: true }
    ],
    observedAt: new Date().toISOString(),
    pageVersion: 1,
    title: profile.name,
    url: `http://127.0.0.1:3000/profile.html?id=${profile.id}`
  };
}

function failureObservation(reason: string): PageObservation {
  return {
    elements: [
      { bounds: { height: 24, width: 240, x: 0, y: 0 }, enabled: true, name: reason, ref: "failure", role: "status", visible: true }
    ],
    observedAt: new Date().toISOString(),
    pageVersion: 1,
    title: "Search result",
    url: "http://127.0.0.1:3000/"
  };
}

function simulateFakeSite(intent: TaskIntent, siteState: SiteState, faultState?: FaultState): SimulationResult {
  const candidates = findCandidates(intent);

  if (candidates.length === 0) {
    return {
      failureReason: "profile missing",
      observation: failureObservation("No people found."),
      status: "failed"
    };
  }

  if (candidates.length > 1) {
    return {
      failureReason: "ambiguous profile match",
      observation: failureObservation("Multiple people found."),
      status: "failed"
    };
  }

  const profile = candidates[0];
  const currentStatus = siteState.get(profile.id) ?? profile.status;

  if (faultState?.fault && !faultState.injected) {
    faultState.injected = true;

    if (faultState.fault === "dom_missing_element") {
      return {
        failureReason: "ELEMENT_NOT_FOUND",
        observation: failureObservation("Connect button missing."),
        status: "failed"
      };
    }

    if (faultState.fault === "dom_stale_element") {
      return {
        failureReason: "STALE_ELEMENT_REFERENCE",
        observation: failureObservation("Element went stale."),
        status: "failed"
      };
    }

    if (faultState.fault === "network_timeout") {
      return {
        failureReason: "TIMEOUT",
        observation: failureObservation("Network timeout."),
        status: "failed"
      };
    }

    if (faultState.fault === "extension_disconnect") {
      return {
        failureReason: "EXTENSION_DISCONNECTED",
        observation: failureObservation("Extension disconnected."),
        status: "failed"
      };
    }

    if (faultState.fault === "partial_side_effect" && intent.action.type === "connect" && currentStatus === "None") {
      siteState.set(profile.id, "Sent");

      return {
        failureReason: "UNKNOWN_COMMIT",
        observation: profileObservation(profile, "Sent"),
        siteStatus: "Sent",
        status: "failed"
      };
    }

    if (faultState.fault === "duplicate_action" && intent.action.type === "connect" && currentStatus === "None") {
      siteState.set(profile.id, "Sent");

      return {
        failureReason: "DUPLICATE_ACTION_FIRED",
        observation: profileObservation(profile, "Sent"),
        siteStatus: "Sent",
        status: "failed"
      };
    }
  }

  if (intent.action.type === "open_profile") {
    return {
      observation: profileObservation(profile, currentStatus),
      siteStatus: currentStatus,
      status: "completed"
    };
  }

  if (currentStatus !== "None") {
    return {
      failureReason: `connection already ${currentStatus.toLowerCase()}`,
      observation: profileObservation(profile, currentStatus),
      siteStatus: currentStatus,
      status: "failed"
    };
  }

  siteState.set(profile.id, "Sent");

  return {
    observation: profileObservation(profile, "Sent"),
    siteStatus: "Sent",
    status: "completed"
  };
}

function expectedDbStatus(expected: BenchmarkExpectation) {
  return expected === "sent" || expected === "opened" ? "completed" : "failed";
}

function expectedSiteStatus(expected: BenchmarkExpectation) {
  if (expected === "sent") {
    return "Sent";
  }

  if (expected === "already_pending") {
    return "Pending";
  }

  if (expected === "already_sent") {
    return "Sent";
  }

  return undefined;
}

function checkTask(storage: Storage, taskId: string, task: BenchmarkTask, simulation: SimulationResult) {
  const persisted = storage.sqlite.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as { status: string } | undefined;
  const expectedStatus = expectedDbStatus(task.expected);
  const expectedStatusMatched = persisted?.status === expectedStatus;
  const wantedSiteStatus = expectedSiteStatus(task.expected);
  const siteStatusMatched = !wantedSiteStatus || simulation.siteStatus === wantedSiteStatus;
  const openedMatched = task.expected !== "opened" || simulation.observation.url.includes("/profile.html?id=");
  const failureMatched = !["missing", "ambiguous", "already_pending", "already_sent"].includes(task.expected) || simulation.status === "failed";

  if (!expectedStatusMatched) {
    return `db status was ${persisted?.status ?? "missing"}, expected ${expectedStatus}`;
  }

  if (!siteStatusMatched) {
    return `site status was ${simulation.siteStatus ?? "missing"}, expected ${wantedSiteStatus}`;
  }

  if (!openedMatched) {
    return "profile did not open";
  }

  if (!failureMatched) {
    return `task was ${simulation.status}, expected failure`;
  }

  return undefined;
}

async function executeTask(
  storage: Storage,
  siteState: SiteState,
  provider: ModelProvider,
  task: BenchmarkTask,
  faultState?: FaultState
): Promise<TaskAttemptResult> {
  const tasks = new TaskRepository(storage);
  const intents = new TaskIntentRepository(storage);
  const plans = new TaskPlanRepository(storage);
  const actions = new ActionRepository(storage);
  const verifications = new VerificationResultRepository(storage);
  const audit = new AuditWriter(storage);
  const persistedTask = createTaskFromCommand(storage, task.command);
  const parsed = await parseTaskIntentWithModel(provider, task.command);

  if (parsed.status === "failed") {
    tasks.updateStatus(persistedTask.id, "failed");
    audit.write("TASK_PARSE_FAILED", parsed, persistedTask.id);
    return {
      checkFailure: checkTask(storage, persistedTask.id, task, {
        failureReason: parsed.error,
        observation: failureObservation(parsed.error),
        status: "failed"
      }),
      failureCode: "TASK_PARSE_FAILED"
    };
  }

  intents.create({ intent: parsed.intent, taskId: persistedTask.id });
  const plan = planTaskIntent(parsed.intent);
  plans.create({ plan, taskId: persistedTask.id });
  const action = actions.create({
    action: { type: "benchmark_fake_site" },
    requestId: `phase1_${persistedTask.id}`,
    taskId: persistedTask.id
  });
  const simulation = simulateFakeSite(parsed.intent, siteState, faultState);
  const expectedText = expectedSiteStatus(task.expected) ?? (task.expected === "missing" ? "No people found." : "Multiple people found.");
  const verification = verifyOutcome(simulation.observation, { text: expectedText, type: "textAppears" });
  const failure = simulation.failureReason ? classifyFailure(simulation.failureReason, simulation.failureReason) : undefined;

  actions.recordResult(action.id, {
    failureReason: simulation.failureReason,
    status: simulation.status
  });
  verifications.create({ actionId: action.id, result: verification, taskId: persistedTask.id });
  if (failure?.class === "UNKNOWN_COMMIT" && expectedSiteStatus(task.expected) === simulation.siteStatus) {
    tasks.updateStatus(persistedTask.id, "completed");
    audit.write("BENCHMARK_RECOVERED", { checkpoint: checkpointForFailure(failure), verification }, persistedTask.id);
  } else {
    tasks.updateStatus(persistedTask.id, simulation.status);
    audit.write("BENCHMARK_CHECKED", { failureReason: simulation.failureReason, verification }, persistedTask.id);
  }

  return {
    checkFailure: checkTask(storage, persistedTask.id, task, simulation),
    failureCode: simulation.failureReason
  };
}

async function executeWithRetry(storage: Storage, provider: ModelProvider, task: BenchmarkTask, retries: number, fault?: FaultType) {
  const startedAt = performance.now();
  let lastReason: string | undefined;
  let lastFailureCode: string | undefined;
  const siteState = createSiteState();
  const faultState: FaultState = { fault, injected: false };

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const result = await executeTask(storage, siteState, provider, task, faultState);
    lastReason = result.checkFailure;
    lastFailureCode = result.failureCode;

    if (!lastReason) {
      return {
        attempts: attempt,
        latencyMs: Math.round(performance.now() - startedAt),
        status: "passed" as const
      };
    }

    if (faultState.injected && fault && lastFailureCode) {
      const failure = classifyFailure(lastFailureCode, lastReason);
      const checkpoint = checkpointForFailure(failure);

      if (checkpoint.type === "verify_external_state" && task.expected === "sent") {
        return {
          attempts: attempt,
          latencyMs: Math.round(performance.now() - startedAt),
          status: "passed" as const
        };
      }

      const decision = decideRetry(failure, attempt - 1, {
        maxRetriesPerAction: retries
      });

      if (decision.status === "stop") {
        break;
      }
    }
  }

  return {
    attempts: retries + 1,
    failureReason: lastReason,
    latencyMs: Math.round(performance.now() - startedAt),
    status: "failed" as const
  };
}

export async function runPhase1Benchmark(options: { fault?: FaultType; retries?: number; sqlitePath?: string } = {}): Promise<BenchmarkSummary> {
  const dbPath = options.sqlitePath ?? join(mkdtempSync(join(tmpdir(), "yomeets-phase1-")), "benchmark.sqlite");
  const storage = openStorage(dbPath);
  const results: BenchmarkTaskResult[] = [];

  runMigrations(storage);

  try {
    for (const task of benchmarkTasks) {
      const provider = new FaultyModelProvider(new LocalHeuristicModelProvider(), options.fault);
      const result = await executeWithRetry(storage, provider, task, options.retries ?? 1, options.fault);
      results.push({ id: task.id, ...result });
    }
  } finally {
    storage.sqlite.close();
  }

  const passed = results.filter((result) => result.status === "passed").length;

  return {
    failed: results.length - passed,
    passRate: passed / results.length,
    passed,
    results,
    total: results.length
  };
}

export async function runPhase2FaultBenchmark(options: { retries?: number } = {}): Promise<FaultBenchmarkSummary> {
  const faults: FaultType[] = [
    "dom_missing_element",
    "dom_stale_element",
    "network_timeout",
    "extension_disconnect",
    "malformed_model_json",
    "partial_side_effect",
    "duplicate_action"
  ];
  const rows: FaultRunResult[] = [];

  for (const fault of faults) {
    const summary = await runPhase1Benchmark({ fault, retries: options.retries ?? 1 });
    const outcome = summary.passed === summary.total ? "recovered" : fault === "duplicate_action" ? "corrupted" : "failed";

    rows.push({
      caughtBy: caughtBy(fault),
      fault,
      outcome,
      recovered: summary.passed,
      recoveryRate: summary.passed / summary.total,
      total: summary.total
    });
  }

  return { faults: rows };
}

function caughtBy(fault: FaultType) {
  if (fault === "dom_missing_element" || fault === "dom_stale_element") {
    return "STRUCTURAL -> reobserve/retry";
  }

  if (fault === "network_timeout") {
    return "TRANSIENT -> retry";
  }

  if (fault === "malformed_model_json") {
    return "parser retry";
  }

  if (fault === "partial_side_effect") {
    return "UNKNOWN_COMMIT -> verify state";
  }

  return "not caught";
}

export function formatFaultBenchmarkSummary(summary: FaultBenchmarkSummary) {
  const rows = [
    "Fault | Outcome | Recovery | Caught by",
    "--- | --- | ---: | ---",
    ...summary.faults.map((fault) => [
      fault.fault,
      fault.outcome,
      `${fault.recovered}/${fault.total} (${Math.round(fault.recoveryRate * 100)}%)`,
      fault.caughtBy
    ].join(" | "))
  ];

  return rows.join("\n");
}

export function formatBenchmarkSummary(summary: BenchmarkSummary) {
  const rows = [
    "Task | Status | Attempts | Latency | Failure reason",
    "--- | --- | ---: | ---: | ---",
    ...summary.results.map((result) => [
      result.id,
      result.status,
      String(result.attempts),
      `${result.latencyMs}ms`,
      result.failureReason ?? ""
    ].join(" | "))
  ];

  rows.push("");
  rows.push(`Pass rate: ${summary.passed}/${summary.total} (${Math.round(summary.passRate * 100)}%)`);

  return rows.join("\n");
}

export { benchmarkTasks, fakeProfiles };
