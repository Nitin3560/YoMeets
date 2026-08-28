export type AudioSourceKind = "microphone" | "system" | "mixed" | "fixture";

export type AudioChunk = {
  id: string;
  meetingId: string;
  source: AudioSourceKind;
  startMs: number;
  endMs: number;
  path?: string;
  pcmBase64?: string;
};

export type SttSegment = {
  id: string;
  meetingId: string;
  startMs: number;
  endMs: number;
  text: string;
  final: boolean;
};

export type DiarizedSegment = SttSegment & {
  speakerLabel: string;
  confidence: number;
  source: "live_audio" | "live_transcript" | "fixture";
};

export type AudioRecorder = {
  start(meetingId: string): AsyncIterable<AudioChunk>;
  stop(): Promise<void>;
};

export type StreamingSttProvider = {
  transcribe(chunks: AsyncIterable<AudioChunk>): AsyncIterable<SttSegment>;
};

export type StreamingDiarizationProvider = {
  diarize(segments: AsyncIterable<SttSegment>): AsyncIterable<DiarizedSegment>;
};

export type LiveAudioProviderConfig = {
  meetingAudioPath: string;
  microphoneDeviceId?: string;
  systemAudioDeviceId?: string;
  sttProvider: "deepgram" | "whisper" | "assemblyai" | "custom";
  diarizationProvider: "pyannote" | "nvidia" | "deepgram" | "custom";
};

export type LiveAudioPipeline = {
  stream(meetingId: string): AsyncIterable<DiarizedSegment>;
  stop(): Promise<void>;
};

export type SimulatedTurn = {
  speakerLabel: string;
  text: string;
  durationMs?: number;
  pauseAfterMs?: number;
};

export type LiveTranscriptLine = {
  speakerLabel: string;
  text: string;
  startMs: number;
  endMs?: number;
};

export class AudioProviderNotConfiguredError extends Error {
  constructor(readonly provider: string) {
    super(`${provider} is not configured`);
    this.name = "AudioProviderNotConfiguredError";
  }
}

export class NotConfiguredAudioRecorder implements AudioRecorder {
  constructor(private readonly provider = "audio recorder") {}

  async *start(_meetingId: string): AsyncIterable<AudioChunk> {
    throw new AudioProviderNotConfiguredError(this.provider);
  }

  async stop(): Promise<void> {}
}

export class NotConfiguredSttProvider implements StreamingSttProvider {
  constructor(private readonly provider = "streaming STT provider") {}

  async *transcribe(_chunks: AsyncIterable<AudioChunk>): AsyncIterable<SttSegment> {
    throw new AudioProviderNotConfiguredError(this.provider);
  }
}

export class NotConfiguredDiarizationProvider implements StreamingDiarizationProvider {
  constructor(private readonly provider = "streaming diarization provider") {}

  async *diarize(_segments: AsyncIterable<SttSegment>): AsyncIterable<DiarizedSegment> {
    throw new AudioProviderNotConfiguredError(this.provider);
  }
}

export class ProviderBackedLiveAudioPipeline implements LiveAudioPipeline {
  constructor(
    private readonly recorder: AudioRecorder,
    private readonly stt: StreamingSttProvider,
    private readonly diarization: StreamingDiarizationProvider
  ) {}

  stream(meetingId: string): AsyncIterable<DiarizedSegment> {
    return this.diarization.diarize(this.stt.transcribe(this.recorder.start(meetingId)));
  }

  stop(): Promise<void> {
    return this.recorder.stop();
  }
}

async function* turnsToStt(meetingId: string, turns: SimulatedTurn[]): AsyncIterable<SttSegment & { speakerLabel: string }> {
  let cursorMs = 0;

  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];

    if (!turn) {
      continue;
    }

    const durationMs = turn.durationMs ?? Math.max(900, turn.text.length * 35);
    const startMs = cursorMs;
    const endMs = startMs + durationMs;

    yield {
      endMs,
      final: true,
      id: `sim_seg_${index + 1}`,
      meetingId,
      speakerLabel: turn.speakerLabel,
      startMs,
      text: turn.text
    };

    cursorMs = endMs + (turn.pauseAfterMs ?? 250);
  }
}

export class FixtureAudioPipeline {
  constructor(private readonly turns: SimulatedTurn[]) {}

  async *stream(meetingId: string): AsyncIterable<DiarizedSegment> {
    for await (const segment of turnsToStt(meetingId, this.turns)) {
      yield {
        ...segment,
        confidence: 1,
        source: "fixture"
      };
    }
  }
}

function parseTimestamp(value: string) {
  const parts = value.split(":").map((part) => Number.parseInt(part, 10));

  if (parts.some((part) => Number.isNaN(part))) {
    return undefined;
  }

  if (parts.length === 2) {
    return ((parts[0] ?? 0) * 60 + (parts[1] ?? 0)) * 1000;
  }

  if (parts.length === 3) {
    return (((parts[0] ?? 0) * 60 * 60) + ((parts[1] ?? 0) * 60) + (parts[2] ?? 0)) * 1000;
  }

  return undefined;
}

export function parseLiveTranscriptLine(line: string): LiveTranscriptLine | undefined {
  const match = line.match(/^\s*(?<time>\d{1,2}:\d{2}(?::\d{2})?)\s+(?<speaker>[A-Za-z][A-Za-z0-9_-]*):\s*(?<text>.+?)\s*$/);
  const startMs = match?.groups?.time ? parseTimestamp(match.groups.time) : undefined;
  const speakerLabel = match?.groups?.speaker;
  const text = match?.groups?.text;

  if (startMs === undefined || !speakerLabel || !text) {
    return undefined;
  }

  return {
    speakerLabel,
    startMs,
    text
  };
}

export class LiveTranscriptLinePipeline implements LiveAudioPipeline {
  constructor(private readonly lines: AsyncIterable<string> | Iterable<string>) {}

  async *stream(meetingId: string): AsyncIterable<DiarizedSegment> {
    let index = 0;
    let previous: LiveTranscriptLine | undefined;

    for await (const line of this.lines) {
      const current = parseLiveTranscriptLine(line);

      if (!current) {
        continue;
      }

      if (previous) {
        index += 1;
        yield {
          confidence: 1,
          endMs: previous.endMs ?? current.startMs,
          final: true,
          id: `line_seg_${index}`,
          meetingId,
          source: "live_transcript",
          speakerLabel: previous.speakerLabel,
          startMs: previous.startMs,
          text: previous.text
        };
      }

      previous = current;
    }

    if (previous) {
      index += 1;
      yield {
        confidence: 1,
        endMs: previous.endMs ?? previous.startMs + Math.max(900, previous.text.length * 35),
        final: true,
        id: `line_seg_${index}`,
        meetingId,
        source: "live_transcript",
        speakerLabel: previous.speakerLabel,
        startMs: previous.startMs,
        text: previous.text
      };
    }
  }

  async stop(): Promise<void> {}
}
