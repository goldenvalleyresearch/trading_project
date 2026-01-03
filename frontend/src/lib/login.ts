// new-frontend/src/lib/login.ts
import { apiGet, apiPost, setAccessToken } from "./api";

export type LoginResp =
  | { ok: true; redirect: string }
  | { ok: false; error: string };

export type LoginArgs = {
  emailOrUser: string;
  password: string;
  remember: boolean;
};

function pickLoginMsg(x: unknown): string {
  if (!x || typeof x !== "object") return "Login failed.";
  const o = x as Record<string, unknown>;
  return (
    (typeof o.detail === "string" && o.detail) ||
    (typeof o.error === "string" && o.error) ||
    (typeof o.message === "string" && o.message) ||
    "Login failed."
  );
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

function isOkTrue(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as any).ok === true;
}

async function roleBasedRedirect(fallback = "/portfolio"): Promise<string> {
  try {
    const me = await apiGet<any>("/api/auth/me");
    const role =
      (typeof me?.role === "string" && me.role) ||
      (typeof me?.user?.role === "string" && me.user.role) ||
      "";

    if (role.toLowerCase() === "admin") return "/upload";
    return fallback;
  } catch {
    return fallback;
  }
}

export async function checkSession(): Promise<LoginResp | { ok: false }> {
  try {
    const data = await apiGet<unknown>("/api/auth/session");
    if (!isOkTrue(data)) return { ok: false };

    const token = readAccessToken(data);
    if (token) setAccessToken(token);

    const backendRedirect = readRedirect(data) ?? "/portfolio";
    const redirect = await roleBasedRedirect(backendRedirect);

    return { ok: true, redirect };
  } catch {
    return { ok: false };
  }
}

export async function login(args: LoginArgs): Promise<LoginResp> {
  try {
    const data = await apiPost<unknown>("/api/auth/login", {
      emailOrUser: args.emailOrUser.trim(),
      password: args.password,
      remember: args.remember,
    });

    if (!isOkTrue(data)) return { ok: false, error: pickLoginMsg(data) };

    const token = readAccessToken(data);
    if (!token) return { ok: false, error: "Missing access token from server." };
    setAccessToken(token);

    const backendRedirect = readRedirect(data) ?? "/portfolio";
    const redirect = await roleBasedRedirect(backendRedirect);

    return { ok: true, redirect };
  } catch (e: unknown) {
    const anyErr = e as any;
    const payload = anyErr?.data ?? anyErr?.response ?? null;

    return {
      ok: false,
      error: payload
        ? pickLoginMsg(payload)
        : e instanceof Error
        ? e.message
        : "Login failed.",
    };
  }
}

export async function logout(): Promise<void> {
  try {
    await apiPost("/api/auth/logout");
  } finally {
    setAccessToken(null);
  }
}