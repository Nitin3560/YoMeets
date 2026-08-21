import assert from "node:assert/strict";
import { normalizeTranscript } from "./transcript.js";

assert.deepEqual(normalizeTranscript({ text: "  Find   John Smith\nat Google  " }), {
  command: "Find John Smith at Google",
  rawText: "  Find   John Smith\nat Google  ",
  source: "voice"
});

assert.equal(normalizeTranscript({ source: "typed", text: "Search Sarah" }).source, "typed");

assert.throws(() => {
  normalizeTranscript({ text: "   " });
});
