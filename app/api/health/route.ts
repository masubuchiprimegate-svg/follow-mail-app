import { NextResponse } from "next/server";
import { checkGeminiConnection } from "@/lib/gemini";
import { getMicrosoftGraphStatus } from "@/lib/graph";
import { getSupabaseEnvStatus } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { formatSupabaseError } from "@/lib/supabaseError";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseEnv = getSupabaseEnvStatus();
  let supabaseStatus:
    | { ok: true; missing: string[]; error: null }
    | { ok: false; missing: string[]; error: string };

  if (!supabaseEnv.ok) {
    supabaseStatus = {
      ok: false,
      missing: supabaseEnv.missing,
      error: `Supabaseの環境変数が不足しています。不足: ${supabaseEnv.missing.join(", ")}`
    };
  } else {
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.from("leads").select("id", { count: "exact", head: true });

      supabaseStatus = error
        ? {
            ok: false,
            missing: [],
            error: formatSupabaseError("Supabase接続確認", error)
          }
        : { ok: true, missing: [], error: null };
    } catch (error) {
      supabaseStatus = {
        ok: false,
        missing: [],
        error: error instanceof Error ? error.message : "Supabase接続確認に失敗しました。"
      };
    }
  }

  const geminiStatus = await checkGeminiConnection();
  const microsoftStatus = getMicrosoftGraphStatus();

  return NextResponse.json({
    ok: supabaseStatus.ok && geminiStatus.ok,
    supabase: supabaseStatus,
    gemini: geminiStatus,
    microsoft: {
      ok: microsoftStatus.ok,
      missing: microsoftStatus.missing,
      error: microsoftStatus.ok ? null : microsoftStatus.message
    }
  });
}
