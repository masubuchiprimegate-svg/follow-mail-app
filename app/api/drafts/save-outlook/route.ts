import { NextResponse } from "next/server";
import { jsonError } from "@/lib/apiError";
import { MicrosoftGraphConfigError, createOutlookDraft } from "@/lib/graph";
import { formatSupabaseError } from "@/lib/supabaseError";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { draftSaveSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const payload = draftSaveSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", payload.lead_id)
      .single();

    if (leadError) {
      return NextResponse.json({ error: formatSupabaseError("営業先情報の取得", leadError) }, { status: 500 });
    }

    let outlookDraft;

    try {
      outlookDraft = await createOutlookDraft({
        to: lead.email,
        subject: payload.subject,
        body: payload.body
      });
    } catch (error) {
      if (error instanceof MicrosoftGraphConfigError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      return jsonError(error);
    }

    const { data: draft, error: draftError } = await supabase
      .from("email_drafts")
      .insert({
        lead_id: payload.lead_id,
        subject: payload.subject,
        body: payload.body,
        outlook_message_id: outlookDraft.id
      })
      .select("*")
      .single();

    if (draftError) {
      return NextResponse.json({ error: formatSupabaseError("Outlook保存済みメールのDB保存", draftError) }, { status: 500 });
    }

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({
        status: "draft_created",
        outlook_draft_id: outlookDraft.id
      })
      .eq("id", payload.lead_id);

    if (leadUpdateError) {
      return NextResponse.json({ error: formatSupabaseError("営業先ステータス更新", leadUpdateError) }, { status: 500 });
    }

    return NextResponse.json({ draft, outlookDraft });
  } catch (error) {
    return jsonError(error);
  }
}
