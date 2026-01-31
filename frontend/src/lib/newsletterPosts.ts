// src/lib/newsletterPosts.ts

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type PostKind = "premarket" | "afterhours";

export type PostListItem = {
  id: string;
  title: string;
  kind: PostKind;
  slug: string;
  published: boolean;
  created_at: string;
};

export type PostResp = {
  id: string;
  title: string;
  kind: PostKind;
  slug: string;
  content_md: string;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export async function listPosts(kind: PostKind, limit = 50): Promise<PostListItem[]> {
  const url = `${API_BASE}/api/newsletter/posts?kind=${encodeURIComponent(kind)}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Failed to load posts (${res.status})`);
  }
  const j = (await res.json()) as { items: PostListItem[] };
  return j.items ?? [];
}

export async function getPost(slug: string): Promise<PostResp> {
  const url = `${API_BASE}/api/newsletter/posts/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Failed to load post (${res.status})`);
  }
  return (await res.json()) as PostResp;
}

export type CreatePostReq = {
  title: string;
  kind: PostKind;
  content_md: string;
  published: boolean;
};

export async function createPost(body: CreatePostReq): Promise<PostResp> {
  const url = `${API_BASE}/api/admin/newsletter/posts`;

  // Uses cookie-based auth (credentials: include)
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const j: any = await res.json().catch(() => null);
      throw new Error(j?.detail || j?.message || `Create failed (${res.status})`);
    }
    const t = await res.text().catch(() => "");
    throw new Error(t || `Create failed (${res.status})`);
  }

  return (await res.json()) as PostResp;
}
