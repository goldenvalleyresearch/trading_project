// src/lib/api.ts
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  "http://127.0.0.1:8000";

function toUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return path.startsWith("http") ? path : `${API_BASE}${p}`;
}

export type ApiError = Error & {
  status?: number;
  url?: string;
  method?: string;
  data?: unknown;
};

function makeApiError(args: {
  method: string;
  url: string;
  status: number;
  data: unknown;
}): ApiError {
  const err = new Error(`Request failed (${args.status})`) as ApiError;
  err.status = args.status;
  err.url = args.url;
  err.method = args.method;
  err.data = args.data;
  return err;
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  try {
    const txt = await res.text();
    if (!txt) return null;


    try {
      return JSON.parse(txt);
    } catch {
      return { message: txt.slice(0, 400) };
    }
  } catch {
    return null;
  }
}


const ACCESS_KEY = "access_token";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getAccessToken(): string | null {
  if (!canUseStorage()) return null;
  try {
    const t = localStorage.getItem(ACCESS_KEY);
    return t && t.trim().length ? t : null;
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null) {
  if (!canUseStorage()) return;
  try {
    if (!token) localStorage.removeItem(ACCESS_KEY);
    else localStorage.setItem(ACCESS_KEY, token);
  } catch {

  }
}


const REFRESH_PATH = "/api/auth/refresh";


let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(toUrl(REFRESH_PATH), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });

      const data = await readJsonSafe(res);
      if (!res.ok) return false;

      const token =
        data && typeof data === "object" && typeof (data as any).access_token === "string"
          ? ((data as any).access_token as string)
          : null;

      if (token) setAccessToken(token);

      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

type HttpMethod = "GET" | "POST";

async function rawRequest(
  method: HttpMethod,
  url: string,
  opts?: { body?: unknown; form?: FormData; headers?: Record<string, string> }
): Promise<{ res: Response; data: unknown }> {
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) };

  const init: RequestInit = {
    method,
    cache: "no-store",
    credentials: "include",
    headers,
  };

  if (opts?.form) {
    init.body = opts.form;
    delete headers["Content-Type"];
  } else if (opts?.body !== undefined) {
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }

  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, init);
  const data = await readJsonSafe(res);
  return { res, data };
}

async function request<T>(
  method: HttpMethod,
  path: string,
  opts?: { body?: unknown; form?: FormData },
  didRetry?: boolean
): Promise<T> {
  const url = toUrl(path);

  const { res, data } = await rawRequest(method, url, opts);

  if (res.status === 401 && !didRetry) {
    if (path === REFRESH_PATH) {
      throw makeApiError({ method, url, status: res.status, data });
    }

    const ok = await refreshSession();
    if (ok) {
      return request<T>(method, path, opts, true);
    }
  }

  if (!res.ok) {
    throw makeApiError({ method, url, status: res.status, data });
  }

  return (data ?? ({} as unknown)) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, { body });
}

export function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  return request<T>("POST", path, { form });
}