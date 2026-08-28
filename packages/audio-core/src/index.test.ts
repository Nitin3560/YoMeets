import assert from "node:assert/strict";
import {
  AudioProviderNotConfiguredError,
  FixtureAudioPipeline,
  NotConfiguredAudioRecorder,
  ProviderBackedLiveAudioPipeline,
  type AudioChunk,
  type SttSegment
} from "./index.js";

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

const providerBacked = new ProviderBackedLiveAudioPipeline(
  {
    async *start(meetingId: string) {
      yield {
        endMs: 1000,
        id: "chunk_1",
        meetingId,
        source: "mixed",
        startMs: 0
      };
    },
    async stop() {}
  },
  {
    async *transcribe(chunks: AsyncIterable<AudioChunk>) {
      for await (const chunk of chunks) {
        yield {
          endMs: chunk.endMs,
          final: true,
          id: "stt_1",
          meetingId: chunk.meetingId,
          startMs: chunk.startMs,
          text: "Nitin will create the issue."
        };
      }
    }
  },
  {
    async *diarize(sttSegments: AsyncIterable<SttSegment>) {
      for await (const segment of sttSegments) {
        yield {
          ...segment,
          confidence: 0.91,
          source: "live_audio",
          speakerLabel: "S1"
        };
      }
    }
  }
);

const liveSegments = [];

for await (const segment of providerBacked.stream("meeting_provider_test")) {
  liveSegments.push(segment);
}

assert.equal(liveSegments.length, 1);
assert.equal(liveSegments[0]?.speakerLabel, "S1");
assert.equal(liveSegments[0]?.source, "live_audio");

await assert.rejects(async () => {
  for await (const _segment of new NotConfiguredAudioRecorder("macOS recorder").start("meeting_missing")) {
  }
}, AudioProviderNotConfiguredError);
