import { z } from "zod";

export const CommitmentSchema = z.object({
  actionType: z.enum(["create_issue", "schedule_event", "send_email", "record_decision"]),
  confidence: z.number().min(0).max(1),
  deadline: z.string().nullable().optional(),
  description: z.string().min(1),
  id: z.string().min(1),
  owner: z.string(),
  sourceQuote: z.string().min(1),
  timestamp: z.string().min(1)
});

export const CommitmentListSchema = z.array(CommitmentSchema);

export type Commitment = z.infer<typeof CommitmentSchema>;
export type ActionType = Commitment["actionType"];

export type OwnerRef = {
  speakerClusterId: string;
  participantId?: string;
};

export type Evidence = {
  segmentId: string;
  clipStartMs: number;
  clipEndMs: number;
};

export type SpeakerRef = {
  speakerClusterId: string;
  participantId?: string;
};

export type MeetingAction = {
  id: string;
  meetingId: string;
  description: string;
  ownerRef: OwnerRef;
  deadline?: string;
  status: "open" | "in_progress" | "completed" | "needs_identity";
  evidence: Evidence[];
};

export type MeetingDecision = {
  id: string;
  meetingId: string;
  text: string;
  speakerRef: SpeakerRef;
  evidence: Evidence[];
  supersedes?: string;
};

export type MeetingQuestion = {
  id: string;
  meetingId: string;
  text: string;
  status: "open" | "resolved";
  evidence: Evidence[];
};

export type TranscriptSegment = {
  id: string;
  meetingId: string;
  speakerClusterId: string;
  participantId?: string;
  startMs: number;
  endMs: number;
  text: string;
  final: boolean;
  source: string;
};
