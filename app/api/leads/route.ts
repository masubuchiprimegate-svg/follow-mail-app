import { NextResponse } from "next/server";
import { jsonError } from "@/lib/apiError";
import { formatSupabaseError } from "@/lib/supabaseError";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { leadSchema } from "@/lib/validation";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("leads")
      .select("*, email_drafts(*)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: formatSupabaseError("営業先一覧の取得", error) }, { status: 500 });
    }

    return NextResponse.json({ leads: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = leadSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        ...payload,
        next_follow_up_date: payload.next_follow_up_date || null
      })
      .select("*, email_drafts(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: formatSupabaseError("営業先登録", error) }, { status: 500 });
    }

    return NextResponse.json({ lead: data }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
