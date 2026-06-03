export type Temperature = "ready_to_propose" | "relationship_building" | "low_interest";

export type LeadStatus = "not_created" | "draft_created" | "sent" | "replied";

export type Lead = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  exhibition_name: string;
  conversation_memo: string;
  temperature: Temperature;
  next_follow_up_date: string | null;
  status: LeadStatus;
  outlook_draft_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailDraft = {
  id: string;
  lead_id: string;
  subject: string;
  body: string;
  outlook_message_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadWithDraft = Lead & {
  email_drafts: EmailDraft[];
};

export const temperatureLabels: Record<Temperature, string> = {
  ready_to_propose: "すぐ提案できそう",
  relationship_building: "今後接点作り",
  low_interest: "反応薄い"
};

export const statusLabels: Record<LeadStatus, string> = {
  not_created: "未作成",
  draft_created: "下書き作成済み",
  sent: "送信済み",
  replied: "返信あり"
};
