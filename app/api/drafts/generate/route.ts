import { NextResponse } from "next/server";
import { jsonError } from "@/lib/apiError";
import { GeminiApiError, generateFollowUpDraft } from "@/lib/gemini";
import { formatSupabaseError } from "@/lib/supabaseError";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { leadId } = (await request.json()) as { leadId?: string };

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError) {
      return NextResponse.json({ error: formatSupabaseError("営業先情報の取得", leadError) }, { status: 500 });
    }

    let draft;

    try {
      draft = await generateFollowUpDraft(lead);
    } catch (error) {
      console.error("Draft generation failed:", error);

      if (error instanceof GeminiApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      return jsonError(error);
    }

    const { data, error } = await supabase
      .from("email_drafts")
      .insert({
        lead_id: leadId,
        subject: draft.subject,
        body: draft.body
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: formatSupabaseError("AI生成メールの保存", error) }, { status: 500 });
    }

    return NextResponse.json({ draft: data }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
