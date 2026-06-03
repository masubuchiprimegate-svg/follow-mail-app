export const supabaseEnvKeys = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export const microsoftEnvKeys = [
  "MICROSOFT_TENANT_ID",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "MICROSOFT_USER_ID"
] as const;

export function getMissingEnv(keys: readonly string[]) {
  return keys.filter((key) => !process.env[key]);
}

export function getSupabaseEnvStatus() {
  const missing = getMissingEnv(supabaseEnvKeys);

  return {
    ok: missing.length === 0,
    missing
  };
}

export function getGeminiEnvStatus() {
  const missing = getMissingEnv(["GEMINI_API_KEY"]);

  return {
    ok: missing.length === 0,
    missing
  };
}

export function getMicrosoftEnvStatus() {
  const missing = getMissingEnv(microsoftEnvKeys);

  return {
    ok: missing.length === 0,
    missing
  };
}
