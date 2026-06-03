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

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("leads").delete().eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: formatSupabaseError("営業先の削除", error) }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "営業先を削除しました。関連するメール下書きも削除されています。"
    });
  } catch (error) {
    return jsonError(error);
  }
}
