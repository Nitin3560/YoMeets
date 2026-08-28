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

export type MeetingStateSummary = {
  openActions: Array<Pick<MeetingAction, "id" | "description" | "status">>;
  decisions: Array<Pick<MeetingDecision, "id" | "text" | "supersedes">>;
  openQuestions: Array<Pick<MeetingQuestion, "id" | "text" | "status">>;
};

export const OperationSchema = z.discriminatedUnion("type", [
  z.object({
    deadline: z.string().optional(),
    description: z.string().min(1),
    evidenceEndMs: z.number(),
    evidenceStartMs: z.number(),
    ownerSpeakerId: z.string().min(1),
    type: z.literal("CREATE_ACTION")
  }),
  z.object({
    actionId: z.string().min(1),
    description: z.string().min(1).optional(),
    status: z.enum(["open", "in_progress", "completed", "needs_identity"]).optional(),
    type: z.literal("UPDATE_ACTION")
  }),
  z.object({
    evidenceEndMs: z.number(),
    evidenceStartMs: z.number(),
    speakerId: z.string().min(1),
    supersedes: z.string().min(1).optional(),
    text: z.string().min(1),
    type: z.literal("CREATE_DECISION")
  }),
  z.object({
    evidenceEndMs: z.number(),
    evidenceStartMs: z.number(),
    speakerId: z.string().min(1),
    text: z.string().min(1),
    type: z.literal("CREATE_QUESTION")
  }),
  z.object({
    questionId: z.string().min(1),
    type: z.literal("RESOLVE_QUESTION")
  }),
  z.object({
    type: z.literal("IGNORE")
  })
]);

export const OperationListSchema = z.array(OperationSchema);

export type Operation = z.infer<typeof OperationSchema>;
