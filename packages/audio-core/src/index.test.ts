import assert from "node:assert/strict";
import {
  AudioProviderNotConfiguredError,
  DeepgramDiarizationProvider,
  DeepgramStreamingSttProvider,
  FixtureAudioPipeline,
  LiveTranscriptLinePipeline,
  MacOsFfmpegAudioRecorder,
  NotConfiguredAudioRecorder,
  ProviderBackedLiveAudioPipeline,
  buildDeepgramListenUrl,
  macOsFfmpegArgs,
  parseDeepgramSttMessage,
  parseLiveTranscriptLine,
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

assert.deepEqual(parseLiveTranscriptLine("01:04 S2: Yeah, I'll fix it tomorrow."), {
  speakerLabel: "S2",
  startMs: 64_000,
  text: "Yeah, I'll fix it tomorrow."
});
assert.equal(parseLiveTranscriptLine("this is not a caption line"), undefined);

const deepgramUrl = new URL(buildDeepgramListenUrl());

assert.equal(deepgramUrl.hostname, "api.deepgram.com");
assert.equal(deepgramUrl.searchParams.get("model"), "nova-3");
assert.equal(deepgramUrl.searchParams.get("encoding"), "linear16");
assert.equal(deepgramUrl.searchParams.get("sample_rate"), "16000");
assert.equal(deepgramUrl.searchParams.get("diarize"), "false");
assert.equal(new URL(buildDeepgramListenUrl({ diarize: true })).searchParams.get("diarize"), "true");

assert.deepEqual(parseDeepgramSttMessage("meeting_deepgram", "dg_1", JSON.stringify({
  channel: {
    alternatives: [
      {
        transcript: "Nitin will create the issue.",
        words: [{ speaker: 1 }]
      }
    ]
  },
  duration: 1.5,
  is_final: true,
  start: 2
})), {
  endMs: 3500,
  final: true,
  id: "dg_1",
  meetingId: "meeting_deepgram",
  speakerLabel: "S2",
  startMs: 2000,
  text: "Nitin will create the issue."
});

assert.equal(parseDeepgramSttMessage("meeting_deepgram", "dg_meta", JSON.stringify({ type: "Metadata" })), undefined);

class FakeDeepgramSocket {
  onclose?: () => void;
  onerror?: (event?: unknown) => void;
  onmessage?: (message: { data?: unknown }) => void;
  readonly sent: Array<Buffer | string> = [];

  close() {
    this.onclose?.();
  }

  send(data: Buffer | string) {
    this.sent.push(data);

    if (Buffer.isBuffer(data)) {
      this.onmessage?.({
        data: JSON.stringify({
          channel: {
            alternatives: [{
              transcript: "Sarah will check the timeout.",
              words: [{ speaker: 0 }]
            }]
          },
          duration: 2,
          is_final: true,
          start: 0
        })
      });
      return;
    }

    this.close();
  }
}

const fakeSocket = new FakeDeepgramSocket();
const deepgram = new DeepgramStreamingSttProvider({
  apiKey: "dg_test",
  webSocketFactory: (_url, protocols) => {
    assert.deepEqual(protocols, ["token", "dg_test"]);
    return fakeSocket;
  }
});
const deepgramSegments = [];

for await (const segment of deepgram.transcribe((async function* () {
  yield {
    endMs: 1000,
    id: "audio_1",
    meetingId: "meeting_deepgram",
    pcmBase64: Buffer.from("fake pcm").toString("base64"),
    source: "mixed",
    startMs: 0
  };
})())) {
  deepgramSegments.push(segment);
}

assert.equal(deepgramSegments.length, 1);
assert.equal(deepgramSegments[0]?.meetingId, "meeting_deepgram");
assert.equal(deepgramSegments[0]?.speakerLabel, "S1");
assert.equal(deepgramSegments[0]?.text, "Sarah will check the timeout.");
assert.equal(Buffer.isBuffer(fakeSocket.sent[0]), true);

const deepgramDiarized = [];
const diarizer = new DeepgramDiarizationProvider();

for await (const segment of diarizer.diarize((async function* () {
  yield {
    endMs: 3000,
    final: true,
    id: "dg_2",
    meetingId: "meeting_deepgram",
    speakerLabel: "S3",
    startMs: 1000,
    text: "Let's switch to Postgres."
  };
})())) {
  deepgramDiarized.push(segment);
}

assert.equal(deepgramDiarized[0]?.speakerLabel, "S3");
assert.equal(deepgramDiarized[0]?.source, "live_audio");

assert.deepEqual(macOsFfmpegArgs({ device: "BlackHole 2ch", sampleRate: 16000 }).slice(0, 7), [
  "-hide_banner",
  "-loglevel",
  "error",
  "-f",
  "avfoundation",
  "-i",
  ":BlackHole 2ch"
]);

let killed = false;
let recorderCommand = "";
let recorderArgs: string[] = [];
const recorder = new MacOsFfmpegAudioRecorder({
  device: "MacBook Pro Microphone",
  spawnProcess: (command, args) => {
    recorderCommand = command;
    recorderArgs = args;

    return {
      kill: () => {
        killed = true;
        return true;
      },
      stdout: (async function* () {
        yield Buffer.alloc(3200);
      })()
    };
  }
});
const audioChunks = [];

for await (const chunk of recorder.start("meeting_audio")) {
  audioChunks.push(chunk);
}

await recorder.stop();
assert.equal(recorderCommand, "ffmpeg");
assert.equal(recorderArgs.includes(":MacBook Pro Microphone"), true);
assert.equal(killed, true);
assert.equal(audioChunks[0]?.meetingId, "meeting_audio");
assert.equal(audioChunks[0]?.startMs, 0);
assert.equal(audioChunks[0]?.endMs, 100);
assert.equal(Buffer.from(audioChunks[0]?.pcmBase64 ?? "", "base64").length, 3200);

const liveTranscript = new LiveTranscriptLinePipeline([
  "00:01 S1: Sarah, can you check the auth timeout?",
  "ignored",
  "00:04 S2: Yeah, I'll fix it tomorrow."
], "caption");
const transcriptSegments = [];

for await (const segment of liveTranscript.stream("meeting_caption_test")) {
  transcriptSegments.push(segment);
}

assert.equal(transcriptSegments.length, 2);
assert.equal(transcriptSegments[0]?.id, "caption_seg_1");
assert.equal(transcriptSegments[0]?.endMs, 4000);
assert.equal(transcriptSegments[1]?.source, "live_transcript");
