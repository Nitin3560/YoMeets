import { z } from "zod";

export const TaskTargetSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1).optional(),
  school: z.string().min(1).optional()
});

export const TaskIntentSchema = z.object({
  intent: z.enum(["search_profile", "send_connection_request"]),
  targets: z.array(TaskTargetSchema).min(1),
  action: z.object({
    type: z.enum(["open_profile", "connect"]),
    message: z.string().optional()
  })
});

export type TaskIntent = z.infer<typeof TaskIntentSchema>;
export type TaskTarget = z.infer<typeof TaskTargetSchema>;

export function parseTaskIntent(value: unknown) {
  return TaskIntentSchema.parse(value);
}
