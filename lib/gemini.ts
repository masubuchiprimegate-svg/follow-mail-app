import type { Lead, Temperature } from "@/lib/types";
import { temperatureLabels } from "@/lib/types";

type GeneratedDraft = {
  subject: string;
  body: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type GeminiErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "PERMISSION_DENIED"
  | "QUOTA_EXCEEDED"
  | "MODEL_UNAVAILABLE"
  | "EMPTY_RESPONSE"
  | "INVALID_RESPONSE"
  | "GEMINI_API_ERROR";

export class GeminiApiError extends Error {
  status: number;
  code: GeminiErrorCode;
  detail?: string;

  constructor(message: string, status = 500, code: GeminiErrorCode = "GEMINI_API_ERROR", detail?: string) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

const primaryModel = "gemini-2.5-flash";
const fallbackModel = "gemini-2.0-flash";

const temperatureGuidance: Record<Temperature, string> = {
  ready_to_propose:
    "相手の関心が高そうなので、軽い相談や情報交換の提案を自然に入れる。ただし強い売り込みにはしない。",
  relationship_building:
    "今後の接点づくりを重視し、相手の事業や展示内容への関心を示しながら、必要な時に相談してもらえる余白を残す。",
  low_interest:
    "短く控えめにまとめ、相手の負担にならない距離感で、関係の入口だけを残す。"
};

function extractJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new GeminiApiError(
      "Gemini APIは応答しましたが、JSON形式のメール文面を返しませんでした。もう一度AI生成を実行してください。",
      502,
      "INVALID_RESPONSE"
    );
  }

  return cleaned.slice(start, end + 1);
}

export function parseGeminiErrorDetail(detail: string) {
  try {
    const parsed = JSON.parse(detail) as {
      error?: {
        code?: number;
        message?: string;
        status?: string;
      };
    };

    return {
      message: parsed.error?.message || detail,
      status: parsed.error?.status || ""
    };
  } catch {
    return { message: detail, status: "" };
  }
}

function classifyGeminiError(statusCode: number, detail: string) {
  const { message, status } = parseGeminiErrorDetail(detail);
  const normalized = `${status} ${message}`.toLowerCase();

  if (
    normalized.includes("api key not valid") ||
    normalized.includes("api_key_invalid") ||
    normalized.includes("invalid api key")
  ) {
    return {
      code: "INVALID_API_KEY" as const,
      message:
        "GEMINI_API_KEYが無効です。Google AI Studioで発行した正しいAPIキーを .env.local に設定してください。"
    };
  }

  if (
    statusCode === 403 ||
    normalized.includes("permission_denied") ||
    normalized.includes("forbidden") ||
    normalized.includes("api key expired") ||
    normalized.includes("api key service blocked") ||
    normalized.includes("generative language api has not been used")
  ) {
    return {
      code: "PERMISSION_DENIED" as const,
      message:
        "Gemini APIの利用権限またはAPIキー制限により実行できません。GEMINI_API_KEYのAPI制限、Google Cloudプロジェクト設定、Gemini APIの有効化状態を確認してください。"
    };
  }

  if (statusCode === 429 || normalized.includes("resource_exhausted") || normalized.includes("quota")) {
    return {
      code: "QUOTA_EXCEEDED" as const,
      message:
        "Gemini APIの利用上限またはレート制限に達しています。しばらく待つか、Google Cloudの割り当て設定を確認してください。"
    };
  }

  if (
    normalized.includes("not found") ||
    normalized.includes("not_found") ||
    normalized.includes("not supported") ||
    normalized.includes("unsupported")
  ) {
    return {
      code: "MODEL_UNAVAILABLE" as const,
      message:
        "指定したGeminiモデルが利用できません。gemini-2.5-flash と gemini-2.0-flash がAPIキーのプロジェクトで利用可能か確認してください。"
    };
  }

  return {
    code: "GEMINI_API_ERROR" as const,
    message: `Gemini APIでメール生成に失敗しました。Googleからのエラー: ${message}`
  };
}

function buildPrompt(lead: Lead) {
  return [
    "あなたは日本語のBtoB営業メール作成アシスタントです。",
    "展示会後の関係構築メールを、丁寧だが堅すぎず、売り込み感を抑えて作成します。",
    "必ずJSONで subject と body のみを返してください。",
    "",
    "以下の営業先に送る展示会後フォローメールを作成してください。",
    "",
    `会社名: ${lead.company_name}`,
    `担当者名: ${lead.contact_name}`,
    `メールアドレス: ${lead.email}`,
    `展示会名: ${lead.exhibition_name}`,
    `会話メモ: ${lead.conversation_memo || "特になし"}`,
    `温度感: ${temperatureLabels[lead.temperature]}`,
    `方針: ${temperatureGuidance[lead.temperature]}`,
    "",
    "条件:",
    "- 件名は自然で短め",
    "- 本文は日本語",
    "- 宛名から始める",
    "- 展示会で話した内容に触れる",
    "- 自社サービスは「展示会ブースの設計・施工、映像制作、グラフィックデザイン、各種プロモーション支援」として自然に触れる",
    "- 「お気軽にお声がけください」を自然に入れる",
    "- すぐ提案ではなく、関係構築を重視する",
    "- 署名は入れない",
    "- Markdownのコードフェンスは使わない",
    "- JSON形式: {\"subject\":\"...\",\"body\":\"...\"}"
  ].join("\n");
}

async function callGemini(model: string, prompt: string, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    const classified = classifyGeminiError(response.status, detail);
    console.error("Gemini API error response:", {
      model,
      status: response.status,
      statusText: response.statusText,
      body: detail
    });

    throw new GeminiApiError(classified.message, response.status, classified.code, detail);
  }

  return (await response.json()) as GeminiResponse;
}

function shouldStopFallback(error: unknown) {
  return (
    error instanceof GeminiApiError &&
    ["MISSING_API_KEY", "INVALID_API_KEY", "PERMISSION_DENIED", "QUOTA_EXCEEDED"].includes(error.code)
  );
}

export async function checkGeminiConnection() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      model: null,
      error: "GEMINI_API_KEYが未設定です。.env.local にGoogle Gemini APIキーを設定してください。"
    };
  }

  for (const model of [primaryModel, fallbackModel]) {
    try {
      await callGemini(model, "JSONで {\"ok\":true} だけ返してください。", apiKey);
      return { ok: true, model, error: null };
    } catch (error) {
      if (shouldStopFallback(error)) {
        return {
          ok: false,
          model,
          error: error instanceof Error ? error.message : "Gemini API接続に失敗しました。"
        };
      }

      console.error("Gemini health check model failed:", { model, error });
    }
  }

  return {
    ok: false,
    model: fallbackModel,
    error:
      "Gemini API接続に失敗しました。gemini-2.5-flash と gemini-2.0-flash の両方が利用できません。APIキー、モデル利用可否、クォータを確認してください。"
  };
}

export async function generateFollowUpDraft(lead: Lead): Promise<GeneratedDraft> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new GeminiApiError(
      "GEMINI_API_KEYが未設定です。.env.local にGoogle Gemini APIキーを設定してください。",
      500,
      "MISSING_API_KEY"
    );
  }

  const prompt = buildPrompt(lead);
  let lastError: unknown = null;

  for (const model of [primaryModel, fallbackModel]) {
    try {
      const data = await callGemini(model, prompt, apiKey);
      const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();

      if (!content) {
        throw new GeminiApiError(
          `Gemini APIは応答しましたが、${model} からメール本文が返りませんでした。もう一度AI生成を実行してください。`,
          502,
          "EMPTY_RESPONSE"
        );
      }

      const parsed = JSON.parse(extractJson(content)) as GeneratedDraft;

      if (!parsed.subject || !parsed.body) {
        throw new GeminiApiError(
          `Gemini APIは応答しましたが、${model} の結果に subject または body が含まれていません。もう一度AI生成を実行してください。`,
          502,
          "INVALID_RESPONSE"
        );
      }

      return parsed;
    } catch (error) {
      lastError = error;

      if (shouldStopFallback(error)) {
        throw error;
      }

      console.error("Gemini model attempt failed:", { model, error });
    }
  }

  if (lastError instanceof GeminiApiError) {
    throw new GeminiApiError(
      `${lastError.message} gemini-2.5-flash と gemini-2.0-flash の両方で失敗しました。`,
      lastError.status,
      lastError.code,
      lastError.detail
    );
  }

  throw new GeminiApiError(
    "Gemini APIでメール生成に失敗しました。gemini-2.5-flash と gemini-2.0-flash の両方で失敗しました。",
    500,
    "GEMINI_API_ERROR"
  );
}
