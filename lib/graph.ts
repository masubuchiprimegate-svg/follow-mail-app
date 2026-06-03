import { ConfidentialClientApplication } from "@azure/msal-node";
import { getMicrosoftEnvStatus } from "@/lib/env";

type OutlookDraftInput = {
  to: string;
  subject: string;
  body: string;
};

export class MicrosoftGraphConfigError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "MicrosoftGraphConfigError";
    this.status = status;
  }
}

export function getMicrosoftGraphStatus() {
  const envStatus = getMicrosoftEnvStatus();

  return {
    ok: envStatus.ok,
    missing: envStatus.missing,
    message: envStatus.ok
      ? "Microsoft連携の環境変数は設定されています。"
      : `Microsoft連携が未設定です。不足: ${envStatus.missing.join(", ")}。Outlook下書き保存だけ利用できません。営業先登録とAIメール生成は利用できます。`
  };
}

async function getGraphAccessToken() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const status = getMicrosoftGraphStatus();

  if (!status.ok || !tenantId || !clientId || !clientSecret) {
    throw new MicrosoftGraphConfigError(status.message);
  }

  const app = new ConfidentialClientApplication({
    auth: {
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientId,
      clientSecret
    }
  });

  const result = await app.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"]
  });

  if (!result?.accessToken) {
    throw new Error("Microsoft Graphのアクセストークン取得に失敗しました。Tenant ID、Client ID、Client Secret、管理者同意を確認してください。");
  }

  return result.accessToken;
}

export async function createOutlookDraft(input: OutlookDraftInput) {
  const userId = process.env.MICROSOFT_USER_ID;
  const status = getMicrosoftGraphStatus();

  if (!status.ok || !userId) {
    throw new MicrosoftGraphConfigError(status.message);
  }

  const accessToken = await getGraphAccessToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      subject: input.subject,
      body: {
        contentType: "Text",
        content: input.body
      },
      toRecipients: [
        {
          emailAddress: {
            address: input.to
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Microsoft Graph draft creation failed:", {
      status: response.status,
      statusText: response.statusText,
      body: detail
    });
    throw new Error(`Outlook下書き保存に失敗しました。Microsoft Graphからのエラー: ${detail}`);
  }

  return (await response.json()) as { id: string; webLink?: string };
}
