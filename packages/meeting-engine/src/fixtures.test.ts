import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ScriptedModelProvider } from "@yomeets/model-router";
import { extractCommitments } from "./extractor.js";
import { CommitmentListSchema, type Commitment } from "./types.js";

type TranscriptFixture = {
  id: string;
  text: string;
};

type LabelFixture = {
  id: string;
  commitments: Commitment[];
};

function fixturePath(path: string) {
  return fileURLToPath(new URL(`../../../tests/meeting-fixtures/${path}`, import.meta.url));
}

const transcripts = JSON.parse(readFileSync(fixturePath("transcripts.json"), "utf8")) as TranscriptFixture[];
const labels = JSON.parse(readFileSync(fixturePath("labels.json"), "utf8")) as LabelFixture[];

assert.equal(transcripts.length, 24);
assert.equal(labels.length, transcripts.length);

for (const label of labels) {
  CommitmentListSchema.parse(label.commitments);
}

for (const transcript of transcripts) {
  const label = labels.find((item) => item.id === transcript.id);

  assert.ok(label, `Missing label for ${transcript.id}`);

  const result = await extractCommitments(transcript.text, new ScriptedModelProvider([JSON.stringify(label.commitments)]));

  assert.equal(result.status, "extracted");

  if (result.status === "extracted") {
    assert.deepEqual(result.commitments, label.commitments);
  }
}
