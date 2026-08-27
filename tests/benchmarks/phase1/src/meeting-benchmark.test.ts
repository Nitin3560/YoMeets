import assert from "node:assert/strict";
import { buildMeetingBenchmarkCases, runMeetingBenchmark } from "./meeting-benchmark.js";

const cases = buildMeetingBenchmarkCases();
const metrics = await runMeetingBenchmark(cases);

assert.equal(cases.length, 60);
assert.equal(metrics.totalTranscripts, 60);
assert.equal(metrics.expectedCommitments, 60);
assert.equal(metrics.precision, 1);
assert.equal(metrics.recall, 1);
assert.equal(metrics.ownerAccuracy, 1);
assert.equal(metrics.executionSuccessRate, 1);
assert.equal(metrics.duplicateSideEffectRate, 0);
