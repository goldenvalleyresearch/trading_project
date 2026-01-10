// src/lib/upload.ts
import { apiGet, apiPostForm, ApiError } from "../../lib/api";


export type UploadKey = "positions" | "performance" | "fundamentals" | "factors";

export type UploadResp =
  | { ok: true; message?: string; stored_as?: string; filename?: string }
  | { ok?: false; detail?: any; error?: string; message?: string };

export type ResearchFileItem = {
  kind?: string;
  type?: string;
  name?: string;
  filename?: string;
  stored_as?: string;
  key?: string;
  as_of?: string;
  uploaded_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type EquityCurveResp = { series?: Array<{ date?: string; balance?: number }> };
export type LatestResp = { snapshot_as_of?: string };

export type NewsletterSendResp =
  | { ok: true; sent?: number; skipped?: number; message?: string }
  | { ok?: false; detail?: any; error?: string; message?: string };


const ME_ENDPOINT = "/api/auth/me";

export type AdminGateResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error" };

function isAdmin(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;

  if (payload.role === "admin") return true;
  if (payload.is_admin === true) return true;

  if (payload.user) {
    if (payload.user.role === "admin") return true;
    if (payload.user.is_admin === true) return true;
  }

  return false;
}

export async function requireAdmin(): Promise<AdminGateResult> {
  try {
    const me = await apiGet<any>(ME_ENDPOINT);

    if (me && typeof me === "object" && (me as any).ok === false) {
      return { ok: false, reason: "unauthenticated" };
    }

    if (!isAdmin(me)) return { ok: false, reason: "forbidden" };
    return { ok: true };
  } catch (err) {
    const e = err as ApiError;

    if (e?.status === 401) return { ok: false, reason: "unauthenticated" };
    if (e?.status === 403) return { ok: false, reason: "forbidden" };

    return { ok: false, reason: "error" };
  }
}

export async function gateUploadPage(opts?: {
  loginPath?: string;
  forbiddenPath?: string;
}): Promise<boolean> {
  const loginPath = opts?.loginPath ?? "/login";
  const forbiddenPath = opts?.forbiddenPath ?? "/portfolio";

  const res = await requireAdmin();
  if (res.ok) return true;

  if (typeof window !== "undefined") {
    window.location.replace(res.reason === "unauthenticated" ? loginPath : forbiddenPath);
  }
  return false;
}



function mustIsoDate(asOf: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new Error("as_of must be YYYY-MM-DD");
  }
}

export type ResearchUploadKind = "fundamentals" | "factors";

export type ResearchUploadResp = {
  as_of: string;
  kind: ResearchUploadKind;
  file_id: string;
  inserted_rows: number;
  sha256: string;
  columns_detected: Record<string, string | null>;
};

export async function uploadResearchFile(args: {
  kind: ResearchUploadKind;
  asOf: string;
  file: File;
}): Promise<ResearchUploadResp> {
  const { kind, asOf, file } = args;
  mustIsoDate(asOf);

  const form = new FormData();
  form.append("file", file, file.name);

  const path = `/api/research/upload/${kind}?as_of=${encodeURIComponent(asOf)}`;
  return await apiPostForm<ResearchUploadResp>(path, form);
}

export type IngestPositionsResp = {
  as_of: string;
  positions_written: number;
  sha256: string;
  receipt: any;
};

export type IngestPerformanceResp = {
  rows_written: number;
};

export async function uploadPositions(args: {
  asOf: string;
  file: File;
}): Promise<IngestPositionsResp> {
  const { asOf, file } = args;
  mustIsoDate(asOf);

  const form = new FormData();
  form.append("file", file, file.name);

  const path = `/api/ingest/positions?as_of=${encodeURIComponent(asOf)}`;
  return await apiPostForm<IngestPositionsResp>(path, form);
}

export async function uploadPerformance(args: {
  file: File;
}): Promise<IngestPerformanceResp> {
  const { file } = args;

  const form = new FormData();
  form.append("file", file, file.name);

  const path = `/api/ingest/performance`;
  return await apiPostForm<IngestPerformanceResp>(path, form);
}



export function prettyApiError(e: unknown): string {
  const err = e as ApiError;
  const data = (err && typeof err === "object" && "data" in err ? (err as any).data : null) as any;

  if (data && typeof data === "object" && Array.isArray(data.detail)) {
    const first = data.detail[0];
    const loc = Array.isArray(first?.loc) ? first.loc.join(".") : "request";
    const msg = first?.msg || "Validation error";
    return `${msg} (${loc})`;
  }

  if (data && typeof data === "object" && typeof data.detail === "string") return data.detail;
  if (data && typeof data === "object" && typeof data.message === "string") return data.message;

  return err?.message || "Request failed.";
}