import { spawn } from "node:child_process";
import { closeSync, openSync, writeSync } from "node:fs";

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
  speakerLabel?: string;
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

type DeepgramMessage = {
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      words?: Array<{
        speaker?: number | string;
      }>;
    }>;
  };
  duration?: number;
  is_final?: boolean;
  start?: number;
  type?: string;
};

type WebSocketLike = {
  close(): void;
  send(data: Buffer | string): void;
  addEventListener?: (event: string, listener: (message?: unknown) => void) => void;
  onclose?: ((event: any) => void) | null;
  onerror?: ((event: any) => void) | null;
  onmessage?: ((message: any) => void) | null;
  onopen?: ((event: any) => void) | null;
  readyState?: number;
};

export type DeepgramStreamingSttOptions = {
  apiKey?: string;
  diarize?: boolean;
  endpointing?: number;
  encoding?: "linear16" | "linear32" | "mulaw" | "alaw" | "opus" | "ogg-opus";
  interimResults?: boolean;
  language?: string;
  model?: string;
  sampleRate?: number;
  url?: string;
  webSocketFactory?: (url: string, protocols: string[]) => WebSocketLike;
};

type AudioProcess = {
  kill(signal?: NodeJS.Signals | number): boolean;
  stderr?: AsyncIterable<Buffer>;
  stdout: AsyncIterable<Buffer>;
};

export type MacOsFfmpegRecorderOptions = {
  channels?: number;
  chunkMs?: number;
  device?: string;
  ffmpegPath?: string;
  outputPath?: string;
  sampleRate?: number;
  source?: Extract<AudioSourceKind, "microphone" | "system" | "mixed">;
  spawnProcess?: (command: string, args: string[]) => AudioProcess;
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

function spawnAudioProcess(command: string, args: string[]): AudioProcess {
  return spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function wavHeader(byteLength: number, sampleRate: number, channels: number) {
  const buffer = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + byteLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(byteLength, 40);

  return buffer;
}

export function macOsFfmpegArgs(options: MacOsFfmpegRecorderOptions = {}) {
  const channels = options.channels ?? 1;
  const device = options.device ?? "default";
  const sampleRate = options.sampleRate ?? 16000;

  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "avfoundation",
    "-i",
    `:${device}`,
    "-ac",
    String(channels),
    "-ar",
    String(sampleRate),
    "-f",
    "s16le",
    "pipe:1"
  ];
}

export class MacOsFfmpegAudioRecorder implements AudioRecorder {
  private process?: AudioProcess;

  constructor(private readonly options: MacOsFfmpegRecorderOptions = {}) {}

  async *start(meetingId: string): AsyncIterable<AudioChunk> {
    const sampleRate = this.options.sampleRate ?? 16000;
    const channels = this.options.channels ?? 1;
    const bytesPerMs = (sampleRate * channels * 2) / 1000;
    const output = this.options.outputPath ? openSync(this.options.outputPath, "w") : undefined;
    const process = (this.options.spawnProcess ?? spawnAudioProcess)(
      this.options.ffmpegPath ?? "ffmpeg",
      macOsFfmpegArgs(this.options)
    );
    this.process = process;
    let cursorMs = 0;
    let index = 0;
    let recordedBytes = 0;

    if (output !== undefined) {
      writeSync(output, wavHeader(0, sampleRate, channels));
    }

    void (async () => {
      for await (const _chunk of process.stderr ?? []) {
      }
    })();

    try {
      for await (const chunk of process.stdout) {
        if (chunk.length === 0) {
          continue;
        }

        if (output !== undefined) {
          writeSync(output, chunk);
          recordedBytes += chunk.length;
        }

        const startMs = Math.round(cursorMs);
        const durationMs = chunk.length / bytesPerMs;
        cursorMs += durationMs;
        index += 1;

        yield {
          endMs: Math.round(cursorMs),
          id: `audio_chunk_${index}`,
          meetingId,
          pcmBase64: chunk.toString("base64"),
          source: this.options.source ?? "microphone",
          startMs
        };
      }
    } finally {
      if (output !== undefined) {
        writeSync(output, wavHeader(recordedBytes, sampleRate, channels), 0, 44, 0);
        closeSync(output);
      }
    }
  }

  async stop(): Promise<void> {
    this.process?.kill("SIGTERM");
  }
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

class AsyncQueue<T> {
  private closed = false;
  private readonly pending: T[] = [];
  private readonly waiters: Array<(value: IteratorResult<T>) => void> = [];

  close() {
    this.closed = true;

    while (this.waiters.length > 0) {
      this.waiters.shift()?.({ done: true, value: undefined });
    }
  }

  push(value: T) {
    const waiter = this.waiters.shift();

    if (waiter) {
      waiter({ done: false, value });
      return;
    }

    this.pending.push(value);
  }

  async next(): Promise<IteratorResult<T>> {
    const value = this.pending.shift();

    if (value) {
      return { done: false, value };
    }

    if (this.closed) {
      return { done: true, value: undefined };
    }

    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

function readEnv(name: string) {
  return process.env[name];
}

function defaultWebSocketFactory(url: string, protocols: string[]): WebSocketLike {
  const WebSocketCtor = (globalThis as typeof globalThis & {
    WebSocket?: new (url: string, protocols?: string[]) => WebSocketLike;
  }).WebSocket;

  if (!WebSocketCtor) {
    throw new AudioProviderNotConfiguredError("WebSocket runtime");
  }

  return new WebSocketCtor(url, protocols);
}

export function buildDeepgramListenUrl(options: DeepgramStreamingSttOptions = {}) {
  const url = new URL(options.url ?? "wss://api.deepgram.com/v1/listen");

  url.searchParams.set("model", options.model ?? "nova-3");
  url.searchParams.set("language", options.language ?? "en");
  url.searchParams.set("encoding", options.encoding ?? "linear16");
  url.searchParams.set("sample_rate", String(options.sampleRate ?? 16000));
  url.searchParams.set("endpointing", String(options.endpointing ?? 300));
  url.searchParams.set("interim_results", String(options.interimResults ?? true));
  url.searchParams.set("diarize", String(options.diarize ?? false));

  return url.toString();
}

export function parseDeepgramSttMessage(
  meetingId: string,
  id: string,
  raw: unknown
): (SttSegment & { speakerLabel?: string }) | undefined {
  const message = typeof raw === "string" ? JSON.parse(raw) as DeepgramMessage : raw as DeepgramMessage;
  const alternative = message.channel?.alternatives?.[0];
  const text = alternative?.transcript?.trim();

  if (!text || message.type === "Metadata" || message.type === "UtteranceEnd" || message.type === "SpeechStarted") {
    return undefined;
  }

  const startMs = Math.round((message.start ?? 0) * 1000);
  const endMs = Math.round(((message.start ?? 0) + (message.duration ?? 0)) * 1000);
  const speaker = alternative?.words?.find((word) => word.speaker !== undefined)?.speaker;

  return {
    endMs: endMs > startMs ? endMs : startMs + Math.max(900, text.length * 35),
    final: Boolean(message.is_final),
    id,
    meetingId,
    speakerLabel: speaker === undefined ? undefined : `S${Number(speaker) + 1}`,
    startMs,
    text
  };
}

export class DeepgramStreamingSttProvider implements StreamingSttProvider {
  private socket?: WebSocketLike;

  constructor(private readonly options: DeepgramStreamingSttOptions = {}) {}

  async *transcribe(chunks: AsyncIterable<AudioChunk>): AsyncIterable<SttSegment> {
    const apiKey = this.options.apiKey ?? readEnv("DEEPGRAM_API_KEY");

    if (!apiKey) {
      throw new AudioProviderNotConfiguredError("Deepgram STT");
    }

    const queue = new AsyncQueue<SttSegment>();
    const socket = (this.options.webSocketFactory ?? defaultWebSocketFactory)(
      buildDeepgramListenUrl(this.options),
      ["token", apiKey]
    );
    this.socket = socket;
    let activeMeetingId = "unknown";
    let counter = 0;

    const close = () => queue.close();
    const fail = (event?: unknown) => {
      queue.push({
        endMs: 0,
        final: true,
        id: "deepgram_error",
        meetingId: "unknown",
        startMs: 0,
        text: `Deepgram stream error: ${String(event)}`
      });
      queue.close();
    };
    const onMessage = (message: { data?: unknown }) => {
      try {
        const segment = parseDeepgramSttMessage(activeMeetingId, `deepgram_seg_${counter + 1}`, message.data);

        if (segment) {
          counter += 1;
          queue.push(segment);
        }
      } catch (error) {
        fail(error);
      }
    };

    socket.onclose = close;
    socket.onerror = fail;
    socket.onmessage = onMessage;
    socket.addEventListener?.("close", close);
    socket.addEventListener?.("error", fail);
    socket.addEventListener?.("message", (message) => onMessage(message as { data?: unknown }));

    void (async () => {
      for await (const chunk of chunks) {
        activeMeetingId = chunk.meetingId;

        if (chunk.pcmBase64) {
          socket.send(Buffer.from(chunk.pcmBase64, "base64"));
        }
      }

      socket.send(JSON.stringify({ type: "CloseStream" }));
    })().catch(fail);

    while (true) {
      const next = await queue.next();

      if (next.done) {
        break;
      }

      yield next.value;
    }
  }

  async close(): Promise<void> {
    this.socket?.close();
  }
}

export class DeepgramDiarizationProvider implements StreamingDiarizationProvider {
  async *diarize(segments: AsyncIterable<SttSegment>): AsyncIterable<DiarizedSegment> {
    for await (const segment of segments) {
      const speakerLabel = "speakerLabel" in segment && typeof segment.speakerLabel === "string"
        ? segment.speakerLabel
        : "S1";

      yield {
        ...segment,
        confidence: speakerLabel === "S1" && !("speakerLabel" in segment) ? 0.5 : 0.9,
        source: "live_audio",
        speakerLabel
      };
    }
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
  constructor(
    private readonly lines: AsyncIterable<string> | Iterable<string>,
    private readonly idPrefix = "line"
  ) {}

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
          id: `${this.idPrefix}_seg_${index}`,
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
        id: `${this.idPrefix}_seg_${index}`,
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
