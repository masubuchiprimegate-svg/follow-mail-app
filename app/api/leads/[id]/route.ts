import { NextResponse } from "next/server";
import { jsonError } from "@/lib/apiError";
import { formatSupabaseError } from "@/lib/supabaseError";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { statusSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const payload = statusSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("leads")
      .update({ status: payload.status })
      .eq("id", params.id)
      .select("*, email_drafts(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: formatSupabaseError("ステータス更新", error) }, { status: 500 });
    }

    return NextResponse.json({ lead: data });
  } catch (error) {
    return jsonError(error);
  }
}
