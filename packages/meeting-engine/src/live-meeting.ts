import type { DiarizedSegment } from "@yomeets/audio-core";
import type { ModelProvider } from "@yomeets/model-router";
import type { Storage } from "@yomeets/storage";
import {
  ingestTranscriptSegment,
  loadMeetingStateSummary,
  maybeProcessMeetingWindow,
  type ApplyOperationsResult,
  type MeetingWindowTriggerConfig,
  type MeetingWindowTriggerState
} from "./ingest.js";
import { resolveSpeakerIdentities } from "./speaker-resolver.js";

export type LiveMeetingEvent =
  | {
      segmentId: string;
      sequence: number;
      type: "segment_ingested";
    }
  | {
      result: ApplyOperationsResult;
      sequence: number;
      type: "window_processed";
    }
  | {
      sequence: number;
      type: "speaker_resolution_checked";
    };

export type RunLiveMeetingInput = {
  meetingId: string;
  provider: ModelProvider;
  segments: AsyncIterable<DiarizedSegment>;
  storage: Storage;
  config?: MeetingWindowTriggerConfig;
  state?: MeetingWindowTriggerState;
};

export async function runLiveMeeting(input: RunLiveMeetingInput): Promise<LiveMeetingEvent[]> {
  const events: LiveMeetingEvent[] = [];
  const state = input.state ?? {
    lastProcessedAtMs: 0,
    lastProcessedSequence: 0
  };
  let sequence = 0;

  for await (const segment of input.segments) {
    sequence += 1;
    const ingested = ingestTranscriptSegment(input.storage, {
      endMs: segment.endMs,
      final: segment.final,
      id: segment.id,
      meetingId: input.meetingId,
      sequence,
      source: segment.source,
      speakerLabel: segment.speakerLabel,
      startMs: segment.startMs,
      text: segment.text
    });

    events.push({
      segmentId: ingested.segment.id,
      sequence,
      type: "segment_ingested"
    });

    const result = await maybeProcessMeetingWindow(input.storage, {
      config: input.config,
      currentState: loadMeetingStateSummary(input.storage, input.meetingId),
      meetingId: input.meetingId,
      nowMs: segment.endMs,
      provider: input.provider,
      state
    });

    if (result) {
      events.push({
        result,
        sequence,
        type: "window_processed"
      });
    }

    resolveSpeakerIdentities(input.storage, {
      meetingId: input.meetingId
    });
    events.push({
      sequence,
      type: "speaker_resolution_checked"
    });
  }

  return events;
}
