import { z } from "zod";

export const leadSchema = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().min(1),
  email: z.string().email(),
  exhibition_name: z.string().min(1),
  conversation_memo: z.string().default(""),
  temperature: z.enum(["ready_to_propose", "relationship_building", "low_interest"]),
  next_follow_up_date: z.string().nullable().optional()
});

export const statusSchema = z.object({
  status: z.enum(["not_created", "draft_created", "sent", "replied"])
});

export const draftSaveSchema = z.object({
  lead_id: z.string().uuid(),
  subject: z.string().min(1),
  body: z.string().min(1)
});
