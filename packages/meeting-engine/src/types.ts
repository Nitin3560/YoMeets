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
