# 展示会フォローメール下書き作成MVP

展示会後の営業フォローメールをAIで作成し、画面で確認・編集したあとにOutlook下書きへ保存するNext.jsアプリです。

最初はMicrosoft連携なしで大丈夫です。まずは「営業先登録」と「AIメール生成」だけを動かしてください。

## まず必要なもの

必須:

- Node.js / npm
- Supabaseプロジェクト
- Gemini APIキー

後回しでOK:

- Microsoft Graph / Outlook下書き保存用のAzure設定

## 環境変数

`.env.example` を `.env.local` にコピーします。

```bash
cp .env.example .env.local
```

まず動かすために必要な項目:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

任意項目:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_USER_ID=
```

Microsoft項目が空でも、営業先登録とAIメール生成は動きます。その場合、画面上でMicrosoftはNG表示になり、Outlook保存ボタンは無効になります。

## Supabaseキーの取得方法

1. Supabaseでプロジェクトを作成
2. Project Settings > API を開く
3. Project URL を `NEXT_PUBLIC_SUPABASE_URL` に設定
4. service_role key を `SUPABASE_SERVICE_ROLE_KEY` に設定
5. SQL Editorで [supabase/schema.sql](supabase/schema.sql) を実行

注意: `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用です。ブラウザ側のコードには絶対に書かないでください。

## Gemini APIキーの取得方法

1. [Google AI Studio](https://aistudio.google.com/) を開く
2. Get API key からAPIキーを作成
3. `.env.local` の `GEMINI_API_KEY` に設定

AI生成では最初に `gemini-2.5-flash` を使います。失敗した場合は自動で `gemini-2.0-flash` にフォールバックします。APIキー未設定、無効、クォータ超過、モデル未対応は画面と `/api/health` に日本語で表示されます。

## ローカル起動手順

依存関係をインストールします。

```bash
npm install
```

Supabase SQLを実行します。

```txt
supabase/schema.sql の内容を Supabase SQL Editor で実行
```

`.env.local` に最低限この3つを設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

開発サーバーを起動します。

```bash
npm run dev
```

ブラウザで開きます。

```txt
http://localhost:3000
```

画面左上の「環境チェック」でSupabaseとGeminiがOKになれば、営業先登録とAIメール生成を試せます。

## Vercelデプロイ手順

Outlook連携は後回しで大丈夫です。まずVercelでは、営業先登録、AIメール作成、メール本文コピーまで使える状態を目指します。

1. GitHubにこのプロジェクトをアップロード
2. [Vercel](https://vercel.com/) にログイン
3. Add New > Project を選択
4. GitHubリポジトリを選択
5. Framework Preset が `Next.js` になっていることを確認
6. Environment Variables に必須項目を設定
7. Deploy を押す

Vercelに必ず設定する環境変数:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

Vercelに任意で設定する環境変数:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_USER_ID=
```

Microsoft項目を設定しない場合:

- ビルドは通ります
- 画面表示も落ちません
- 営業先登録は使えます
- AIメール作成は使えます
- 件名コピー、本文コピーは使えます
- Outlook下書き保存ボタンは「Microsoft連携未設定」と表示され、無効になります

デプロイ後、まず確認するURL:

```txt
https://your-project.vercel.app/api/health
```

`supabase.ok` と `gemini.ok` が `true` なら、最初に使う機能は準備OKです。`microsoft.ok` は `false` でも問題ありません。

Vercelで環境変数を変更した場合は、Project Settings > Environment Variables で保存後、Redeployしてください。環境変数は再デプロイ後に反映されます。

## /api/health の確認方法

ブラウザで次を開きます。

```txt
http://localhost:3000/api/health
```

返却例:

```json
{
  "ok": true,
  "supabase": {
    "ok": true,
    "missing": [],
    "error": null
  },
  "gemini": {
    "ok": true,
    "model": "gemini-2.5-flash",
    "error": null
  },
  "microsoft": {
    "ok": false,
    "missing": ["MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_USER_ID"],
    "error": "Microsoft連携が未設定です。不足: MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_USER_ID。Outlook下書き保存だけ利用できません。営業先登録とAIメール生成は利用できます。"
  }
}
```

`ok` はSupabaseとGeminiがOKなら `true` です。Microsoftは後回しにできるため、未設定でも全体の `ok` には含めていません。

## Outlook下書き保存を使う場合

Azure Portalでアプリ登録を作成します。

1. Microsoft Entra ID > アプリの登録
2. `Application (client) ID` を `MICROSOFT_CLIENT_ID` に設定
3. `Directory (tenant) ID` を `MICROSOFT_TENANT_ID` に設定
4. クライアントシークレットを作成し、`MICROSOFT_CLIENT_SECRET` に設定
5. Microsoft Graph の Application permission で `Mail.ReadWrite` を追加
6. 管理者の同意を実行
7. 下書きを作成したいメールボックスのUPNを `MICROSOFT_USER_ID` に設定

このMVPは送信APIを使いません。Outlookに下書きを作るだけです。

## 主なファイル

- UI: [app/page.tsx](app/page.tsx)
- 環境チェックAPI: [app/api/health/route.ts](app/api/health/route.ts)
- 営業先API: [app/api/leads/route.ts](app/api/leads/route.ts)
- AI生成API: [app/api/drafts/generate/route.ts](app/api/drafts/generate/route.ts)
- Outlook保存API: [app/api/drafts/save-outlook/route.ts](app/api/drafts/save-outlook/route.ts)
- Gemini連携: [lib/gemini.ts](lib/gemini.ts)
- Microsoft Graph連携: [lib/graph.ts](lib/graph.ts)
- Supabase SQL: [supabase/schema.sql](supabase/schema.sql)
