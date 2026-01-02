// new-frontend/src/lib/register.ts
import { apiPost, setAccessToken } from "./api";

export type RegisterInput = {
  email: string;
  username: string;
  password: string;
  remember: boolean;
};

function pickMsg(x: unknown): string {
  if (!x || typeof x !== "object") return "Register failed.";
  const o = x as any;

  if (Array.isArray(o.detail)) {
    const first = o.detail[0];
    if (first?.msg) return String(first.msg);
    return "Register failed (invalid input).";
  }

  return (
    (typeof o.detail === "string" && o.detail) ||
    (typeof o.error === "string" && o.error) ||
    (typeof o.message === "string" && o.message) ||
    "Register failed."
  );
}

function isOkTrue(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as any).ok === true;
}

function readRedirect(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const r = (data as any).redirect;
  return typeof r === "string" && r.trim().length ? r : null;
}

function readAccessToken(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const t = (data as any).access_token;
  return typeof t === "string" && t.length ? t : null;
}

export async function registerUser(
  input: RegisterInput
): Promise<{ ok: true; redirect: string } | { ok: false; error: string }> {
  try {
    const payload: RegisterInput = {
      email: input.email.trim().toLowerCase(),
      username: input.username.trim(),
      password: input.password,
      remember: !!input.remember,
    };

    const data = await apiPost<unknown>("/api/auth/register", payload);

    if (!isOkTrue(data)) {
      return { ok: false, error: pickMsg(data) };
    }

    const token = readAccessToken(data);
    if (token) {
      setAccessToken(token);
    } else {
      return { ok: false, error: "Missing access token from server." };
    }

    return { ok: true, redirect: readRedirect(data) ?? "/portfolio" };
  } catch (e: unknown) {
    const anyErr = e as any;
    const payload = anyErr?.data ?? anyErr?.response ?? null;

    return {
      ok: false,
      error: payload
        ? pickMsg(payload)
        : e instanceof Error
        ? e.message
        : "Register failed.",
    };
  }
}