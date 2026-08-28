import assert from "node:assert/strict";
import { FixtureAudioPipeline } from "./index.js";

const pipeline = new FixtureAudioPipeline([
  {
    speakerLabel: "S1",
    text: "Sarah, can you check the auth timeout?"
  },
  {
    speakerLabel: "S2",
    text: "Yeah, I'll fix it tomorrow."
  }
]);

const segments = [];

for await (const segment of pipeline.stream("meeting_audio_test")) {
  segments.push(segment);
}

assert.equal(segments.length, 2);
assert.equal(segments[0]?.speakerLabel, "S1");
assert.equal(segments[1]?.speakerLabel, "S2");
assert.equal(segments[1]?.startMs, (segments[0]?.endMs ?? 0) + 250);
assert.equal(segments.every((segment) => segment.final), true);
