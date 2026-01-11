import { apiGet } from "@/lib/api";

export type NewsletterListItem = {
  id: string;
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  mode?: string | null;
  sent?: number | null;
  skipped?: number | null;
  created_at?: string | null;
};

export type NewsletterListResp = {
  items: NewsletterListItem[];
};

function normalizeItem(x: any): NewsletterListItem {
  const id = String(x?.id ?? x?._id ?? "");
  return {
    id: id || crypto.randomUUID(),
    subject: x?.subject ?? null,
    html: x?.html ?? x?.body_html ?? x?.message_html ?? null,
    text: x?.text ?? x?.body ?? x?.message ?? null,
    mode: x?.mode ?? null,
    sent: typeof x?.sent === "number" ? x.sent : null,
    skipped: typeof x?.skipped === "number" ? x.skipped : null,
    created_at: x?.created_at ?? x?.createdAt ?? null,
  };
}

export async function listNewsletters(opts: { limit?: number; q?: string }): Promise<NewsletterListResp> {
  const limit = Math.max(1, Math.min(200, Number(opts.limit ?? 75)));
  const q = String(opts.q ?? "").trim();

  const url =
    `/api/newsletter/sends?limit=${encodeURIComponent(String(limit))}` +
    (q ? `&q=${encodeURIComponent(q)}` : "");

  const raw: any = await apiGet(url);

  const arr: any[] = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw)
    ? raw
    : [];

  const items = arr.map(normalizeItem).filter((x) => x.id);

  items.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));

  return { items };
}