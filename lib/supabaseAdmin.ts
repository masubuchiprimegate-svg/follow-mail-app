import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnvStatus } from "@/lib/env";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envStatus = getSupabaseEnvStatus();

  if (!envStatus.ok || !url || !serviceRoleKey) {
    throw new Error(
      `Supabaseの環境変数が不足しています。不足: ${envStatus.missing.join(", ")}。SupabaseのProject Settings > APIから値を取得して .env.local に設定してください。`
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
