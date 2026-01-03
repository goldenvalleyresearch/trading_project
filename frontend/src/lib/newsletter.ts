// src/lib/newsletter.ts

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type SubscribeStatus = "subscribed" | "already_subscribed";

export type SubscribeResp = {
  email: string;
  status: SubscribeStatus;
};

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function subscribeNewsletter(email: string): Promise<SubscribeResp> {
  const e = email.trim();

  if (!isValidEmail(e)) {
    throw new Error("Invalid email address");
  }

  const res = await fetch(`${API_BASE}/api/newsletter/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({ email: e }),
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const j: any = await res.json().catch(() => null);
      throw new Error(j?.detail || j?.message || `Subscribe failed (${res.status})`);
    }
    const t = await res.text().catch(() => "");
    throw new Error(t || `Subscribe failed (${res.status})`);
  }

  if (contentType.includes("application/json")) {
    return (await res.json()) as SubscribeResp;
  }

  return { email: e, status: "subscribed" };
}