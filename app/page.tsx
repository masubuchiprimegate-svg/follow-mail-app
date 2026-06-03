"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { EmailDraft, LeadStatus, LeadWithDraft, Temperature } from "@/lib/types";
import { statusLabels, temperatureLabels } from "@/lib/types";

const initialForm = {
  company_name: "",
  contact_name: "",
  email: "",
  exhibition_name: "",
  conversation_memo: "",
  temperature: "relationship_building" as Temperature,
  next_follow_up_date: ""
};

const statusOptions: LeadStatus[] = ["not_created", "draft_created", "sent", "replied"];
const temperatureOptions: Temperature[] = ["ready_to_propose", "relationship_building", "low_interest"];

type HealthStatus = {
  supabase?: { ok: boolean; error: string | null; missing?: string[] };
  gemini?: { ok: boolean; model: string | null; error: string | null };
  microsoft?: { ok: boolean; error: string | null; missing?: string[] };
};

async function getErrorMessage(response: Response, fallback: string) {
  const text = await response.text();

  if (!text) {
    return fallback;
  }

  try {
    const data = JSON.parse(text) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [leads, setLeads] = useState<LeadWithDraft[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [form, setForm] = useState(initialForm);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingOutlook, setIsSavingOutlook] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState<string>("");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [message, setMessage] = useState("");

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  );

  useEffect(() => {
    void loadHealth();
    void loadLeads();
  }, []);

  useEffect(() => {
    if (!selectedLead) {
      setSubject("");
      setBody("");
      return;
    }

    const latestDraft = [...(selectedLead.email_drafts || [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    setSubject(latestDraft?.subject || "");
    setBody(latestDraft?.body || "");
  }, [selectedLead]);

  async function loadHealth() {
    try {
      const response = await fetch("/api/health");

      if (!response.ok) {
        setMessage(await getErrorMessage(response, "環境チェックに失敗しました。/api/health を確認してください。"));
        return;
      }

      const data = await response.json();
      setHealth(data);
    } catch {
      setMessage("環境チェックに失敗しました。開発サーバーが起動しているか確認してください。");
    }
  }

  async function loadLeads() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/leads");

      if (!response.ok) {
        setLeads([]);
        setSelectedLeadId("");
        setMessage(await getErrorMessage(response, "営業先一覧の取得に失敗しました。環境変数やSupabase設定を確認してください。"));
        return;
      }

      const data = await response.json();
      setLeads(data.leads || []);
      setSelectedLeadId((current) => current || data.leads?.[0]?.id || "");
    } catch {
      setLeads([]);
      setSelectedLeadId("");
      setMessage("営業先一覧の取得に失敗しました。/api/leads に接続できません。開発サーバーが起動しているか確認してください。");
    } finally {
      setIsLoading(false);
    }
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSavingLead(true);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          next_follow_up_date: form.next_follow_up_date || null
        })
      });

      if (!response.ok) {
        setMessage(await getErrorMessage(response, "営業先の登録に失敗しました。"));
        return;
      }

      const data = await response.json();
      setLeads((current) => [data.lead, ...current]);
      setSelectedLeadId(data.lead.id);
      setForm(initialForm);
      setMessage("営業先を登録しました。");
    } catch {
      setMessage("営業先の登録に失敗しました。/api/leads に接続できません。開発サーバーが起動しているか確認してください。");
    } finally {
      setIsSavingLead(false);
    }
  }

  async function generateDraft() {
    if (!selectedLead) return;
    setMessage("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedLead.id })
      });

      if (!response.ok) {
        setMessage(await getErrorMessage(response, "メール生成に失敗しました。"));
        return;
      }

      const data = await response.json();
      const draft = data.draft as EmailDraft;
      setSubject(draft.subject);
      setBody(draft.body);
      setLeads((current) =>
        current.map((lead) =>
          lead.id === selectedLead.id
            ? { ...lead, email_drafts: [draft, ...(lead.email_drafts || [])] }
            : lead
        )
      );
      setMessage("AIメール文面を作成しました。内容を確認・編集してから下書き保存してください。");
    } catch {
      setMessage("メール生成に失敗しました。/api/drafts/generate に接続できません。開発サーバーが起動しているか確認してください。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveOutlookDraft() {
    if (!selectedLead) return;
    setMessage("");
    setIsSavingOutlook(true);

    try {
      const response = await fetch("/api/drafts/save-outlook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          subject,
          body
        })
      });

      if (!response.ok) {
        setMessage(await getErrorMessage(response, "Outlook下書き保存に失敗しました。"));
        return;
      }

      const data = await response.json();
      setLeads((current) =>
        current.map((lead) =>
          lead.id === selectedLead.id
            ? {
                ...lead,
                status: "draft_created",
                outlook_draft_id: data.outlookDraft.id,
                email_drafts: [data.draft, ...(lead.email_drafts || [])]
              }
            : lead
        )
      );
      setMessage("Outlookの下書きに保存しました。送信はOutlook側で確認してから行ってください。");
    } catch {
      setMessage("Outlook下書き保存に失敗しました。/api/drafts/save-outlook に接続できません。開発サーバーが起動しているか確認してください。");
    } finally {
      setIsSavingOutlook(false);
    }
  }

  async function copyText(label: string, text: string) {
    if (!text) {
      setMessage(`${label}が空です。コピーする内容がありません。`);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label}をコピーしました。`);
    } catch {
      setMessage(`${label}のコピーに失敗しました。ブラウザのクリップボード許可を確認してください。`);
    }
  }

  async function updateStatus(status: LeadStatus) {
    if (!selectedLead) return;
    setMessage("");

    try {
      const response = await fetch(`/api/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        setMessage(await getErrorMessage(response, "ステータス更新に失敗しました。"));
        return;
      }

      const data = await response.json();
      setLeads((current) => current.map((lead) => (lead.id === selectedLead.id ? data.lead : lead)));
    } catch {
      setMessage("ステータス更新に失敗しました。/api/leads/[id] に接続できません。開発サーバーが起動しているか確認してください。");
    }
  }

  async function deleteLead(leadId: string) {
    const targetLead = leads.find((lead) => lead.id === leadId);
    const confirmed = window.confirm(
      targetLead ? `${targetLead.company_name} を削除しますか？` : "この営業先を削除しますか？"
    );

    if (!confirmed) return;

    setMessage("");
    setDeletingLeadId(leadId);

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        setMessage(await getErrorMessage(response, "営業先の削除に失敗しました。"));
        return;
      }

      setLeads((current) => current.filter((lead) => lead.id !== leadId));

      if (selectedLeadId === leadId) {
        setSelectedLeadId("");
      }

      setMessage("営業先を削除しました。関連するメール下書きも削除されています。");
    } catch {
      setMessage("営業先の削除に失敗しました。/api/leads/[id] に接続できません。開発サーバーが起動しているか確認してください。");
    } finally {
      setDeletingLeadId("");
    }
  }

  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">展示会フォローメール下書き作成</h1>
            <p className="mt-1 text-sm text-slate-600">AIで文面を作成し、確認後にOutlook下書きへ保存します。</p>
          </div>
          <div className="rounded border border-line px-3 py-2 text-sm text-slate-700">
            登録件数 <span className="font-semibold text-ink">{leads.length}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-6 lg:grid-cols-[420px_1fr]">
        <section className="space-y-5">
          <section className="border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">環境チェック</h2>
              <button
                className="border border-line px-3 py-1.5 text-xs font-semibold text-slate-700"
                onClick={() => void loadHealth()}
                type="button"
              >
                再確認
              </button>
            </div>
            <div className="mt-3 grid gap-2 text-sm">
              <HealthLine label="Supabase" ok={health?.supabase?.ok} error={health?.supabase?.error} />
              <HealthLine
                label="Gemini"
                ok={health?.gemini?.ok}
                error={health?.gemini?.error}
                note={health?.gemini?.model ? `使用モデル: ${health.gemini.model}` : undefined}
              />
              <HealthLine label="Microsoft" ok={health?.microsoft?.ok} error={health?.microsoft?.error} />
            </div>
          </section>

          <form onSubmit={createLead} className="border border-line bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">営業先登録</h2>
            <div className="mt-4 grid gap-3">
              <Field label="会社名" value={form.company_name} onChange={(value) => setForm({ ...form, company_name: value })} />
              <Field label="担当者名" value={form.contact_name} onChange={(value) => setForm({ ...form, contact_name: value })} />
              <Field label="メールアドレス" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
              <Field label="展示会名" value={form.exhibition_name} onChange={(value) => setForm({ ...form, exhibition_name: value })} />
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                会話メモ
                <textarea
                  required
                  rows={4}
                  className="resize-none border border-line px-3 py-2 text-ink outline-none focus:border-teal"
                  value={form.conversation_memo}
                  onChange={(event) => setForm({ ...form, conversation_memo: event.target.value })}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                温度感
                <select
                  className="border border-line bg-white px-3 py-2 text-ink outline-none focus:border-teal"
                  value={form.temperature}
                  onChange={(event) => setForm({ ...form, temperature: event.target.value as Temperature })}
                >
                  {temperatureOptions.map((value) => (
                    <option key={value} value={value}>
                      {temperatureLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="次回フォロー予定日"
                type="date"
                value={form.next_follow_up_date}
                onChange={(value) => setForm({ ...form, next_follow_up_date: value })}
              />
            </div>
            <button
              className="mt-4 w-full bg-teal px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isSavingLead}
              type="submit"
            >
              {isSavingLead ? "登録中..." : "営業先を登録"}
            </button>
          </form>

          <section className="border border-line bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">営業先一覧</h2>
            <div className="mt-4 space-y-2">
              {isLoading ? <p className="text-sm text-slate-600">読み込み中...</p> : null}
              {!isLoading && leads.length === 0 ? (
                <p className="text-sm text-slate-600">まだ営業先が登録されていません。</p>
              ) : null}
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className={`border transition ${
                    selectedLeadId === lead.id
                      ? "border-teal bg-teal/5"
                      : "border-line bg-white hover:border-slate-400"
                  }`}
                >
                  <button
                    className="w-full px-3 py-3 text-left"
                    onClick={() => setSelectedLeadId(lead.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{lead.company_name}</p>
                        <p className="mt-1 text-sm text-slate-600">{lead.contact_name} 様</p>
                      </div>
                      <span className="shrink-0 border border-line px-2 py-1 text-xs text-slate-700">
                        {statusLabels[lead.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{lead.exhibition_name}</p>
                  </button>
                  <div className="flex justify-end border-t border-line px-3 py-2">
                    <button
                      className="border border-coral px-3 py-1.5 text-xs font-semibold text-coral disabled:opacity-60"
                      disabled={deletingLeadId === lead.id}
                      onClick={() => void deleteLead(lead.id)}
                      type="button"
                    >
                      {deletingLeadId === lead.id ? "削除中..." : "削除"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="border border-line bg-white p-5 shadow-sm">
          {selectedLead ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <p className="text-sm text-slate-500">選択中の営業先</p>
                  <h2 className="mt-1 text-2xl font-semibold text-ink">{selectedLead.company_name}</h2>
                  <p className="mt-1 text-sm text-slate-700">
                    {selectedLead.contact_name} 様 / {selectedLead.email}
                  </p>
                </div>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  ステータス
                  <select
                    className="min-w-40 border border-line bg-white px-3 py-2 text-ink outline-none focus:border-teal"
                    value={selectedLead.status}
                    onChange={(event) => void updateStatus(event.target.value as LeadStatus)}
                  >
                    {statusOptions.map((value) => (
                      <option key={value} value={value}>
                        {statusLabels[value]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 bg-mist p-4 text-sm text-slate-700 md:grid-cols-3">
                <Info label="展示会名" value={selectedLead.exhibition_name} />
                <Info label="温度感" value={temperatureLabels[selectedLead.temperature]} />
                <Info label="次回フォロー" value={selectedLead.next_follow_up_date || "未設定"} />
                <div className="md:col-span-3">
                  <Info label="会話メモ" value={selectedLead.conversation_memo} />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  className="bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={isGenerating}
                  onClick={() => void generateDraft()}
                  type="button"
                >
                  {isGenerating ? "AI生成中..." : "AIでメール作成"}
                </button>
                <button
                  className="border border-line px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  disabled={!subject}
                  onClick={() => void copyText("件名", subject)}
                  type="button"
                >
                  件名コピー
                </button>
                <button
                  className="border border-line px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  disabled={!body}
                  onClick={() => void copyText("メール本文", body)}
                  type="button"
                >
                  本文コピー
                </button>
                <button
                  className="border border-teal px-4 py-2.5 text-sm font-semibold text-teal disabled:opacity-60"
                  disabled={isSavingOutlook || !subject || !body || health?.microsoft?.ok === false}
                  onClick={() => void saveOutlookDraft()}
                  type="button"
                  title={health?.microsoft?.ok === false ? health.microsoft.error || "Microsoft連携が未設定です。" : undefined}
                >
                  {isSavingOutlook
                    ? "保存中..."
                    : health?.microsoft?.ok === false
                      ? "Microsoft連携未設定"
                      : "確認済みとしてOutlook下書き保存"}
                </button>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  件名
                  <input
                    className="border border-line px-3 py-2 text-ink outline-none focus:border-teal"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  本文
                  <textarea
                    className="min-h-96 resize-y border border-line px-3 py-2 leading-7 text-ink outline-none focus:border-teal"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex min-h-96 items-center justify-center text-sm text-slate-600">
              営業先を登録すると、メール作成画面が表示されます。
            </div>
          )}
        </section>
      </div>

      {message ? (
        <div className="fixed bottom-5 left-1/2 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 border border-line bg-white px-4 py-3 text-sm text-ink shadow-lg">
          {message}
        </div>
      ) : null}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <input
        required={type !== "date"}
        type={type}
        className="border border-line px-3 py-2 text-ink outline-none focus:border-teal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-ink">{value}</p>
    </div>
  );
}

function HealthLine({
  label,
  ok,
  error,
  note
}: {
  label: string;
  ok: boolean | undefined;
  error?: string | null;
  note?: string;
}) {
  const statusText = ok === undefined ? "確認中" : ok ? "OK" : "NG";
  const statusClass = ok === undefined ? "text-slate-500" : ok ? "text-teal" : "text-coral";

  return (
    <div className="border border-line px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink">{label}</span>
        <span className={`text-xs font-semibold ${statusClass}`}>{statusText}</span>
      </div>
      {note ? <p className="mt-1 text-xs text-slate-600">{note}</p> : null}
      {error ? <p className="mt-1 whitespace-pre-wrap text-xs text-coral">{error}</p> : null}
    </div>
  );
}
