type SupabaseErrorLike = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

export function formatSupabaseError(action: string, error: SupabaseErrorLike) {
  const parts = [
    `${action}に失敗しました。`,
    error.message ? `理由: ${error.message}` : "",
    error.details ? `詳細: ${error.details}` : "",
    error.hint ? `ヒント: ${error.hint}` : "",
    error.code ? `コード: ${error.code}` : ""
  ].filter(Boolean);

  return parts.join(" ");
}
