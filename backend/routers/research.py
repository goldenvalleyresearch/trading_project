from __future__ import annotations

import io
import re
import csv
import hashlib
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Request
from pydantic import BaseModel

from core.db import get_db
from core.security import decode_token, require_token_type, get_cookie_tokens

router = APIRouter(prefix="/api/research", tags=["Research"])

ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TICKER_RE = re.compile(r"^[A-Z]{1,7}(?:[.\-][A-Z0-9]{1,3})?$")


# --------------------
# AUTH (admin-only upload)
# --------------------

def _bearer_token(req: Request) -> Optional[str]:
    h = req.headers.get("authorization") or req.headers.get("Authorization")
    if not h:
        return None
    parts = h.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    t = parts[1].strip()
    return t if t else None


def _get_access_token(req: Request) -> Optional[str]:
    t = _bearer_token(req)
    if t:
        return t
    access_cookie, _refresh_cookie = get_cookie_tokens(req)
    return access_cookie


def require_admin(req: Request) -> dict:
    token = _get_access_token(req)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(token)
    require_token_type(payload, "access")

    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    return payload


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_iso_date(d: str) -> str:
    if not ISO_DATE_RE.match(d):
        raise HTTPException(status_code=400, detail="as_of must be YYYY-MM-DD")
    return d


def _norm(s: str) -> str:
    s = str(s or "")
    s = s.replace("\ufeff", "")
    s = s.replace("\u00A0", " ")
    s = re.sub(r"[\u200B-\u200D\uFEFF]", "", s)
    s = re.sub(r"\s+", " ", s.strip().lower())
    return s


def _find_col_exact(df: pd.DataFrame, name: str) -> Optional[str]:
    target = _norm(name)
    for c in df.columns:
        if _norm(c) == target:
            return c
    return None


def _find_col_contains(df: pd.DataFrame, contains_any: list[str]) -> Optional[str]:
    for c in df.columns:
        nc = _norm(c)
        if any(_norm(k) in nc for k in contains_any):
            return c
    return None


def _sniff_delim(preview: str) -> str:
    try:
        d = csv.Sniffer().sniff(preview, delimiters=[",", "\t", ";"])
        return d.delimiter
    except Exception:
        comma = preview.count(",")
        tab = preview.count("\t")
        semi = preview.count(";")
        if tab >= comma and tab >= semi:
            return "\t"
        if comma >= semi:
            return ","
        return ";"


def _read_csv_smart(raw: bytes) -> pd.DataFrame:
    text = raw.decode("utf-8-sig", errors="replace")
    preview_lines = text.splitlines()[:250]
    preview = "\n".join(preview_lines)
    delim = _sniff_delim(preview)

    df = pd.read_csv(
        io.BytesIO(raw),
        sep=delim,
        engine="python",
        dtype=str,
        keep_default_na=False,
    )

    if len(df.columns) == 1:
        df2 = pd.read_csv(io.BytesIO(raw), sep="\t", engine="python", dtype=str, keep_default_na=False)
        df = df2 if len(df2.columns) > 1 else pd.read_csv(io.BytesIO(raw), sep=",", engine="python", dtype=str, keep_default_na=False)

    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")
    df = df.loc[:, ~df.columns.astype(str).str.match(r"^Unnamed")]
    return df


async def _read_upload_table(file: UploadFile) -> Tuple[pd.DataFrame, bytes, str]:
    filename = file.filename or "upload"
    name = filename.lower()

    raw = await file.read()
    await file.close()

    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    if name.endswith((".xlsx", ".xlsm")):
        try:
            bio = io.BytesIO(raw)
            df = pd.read_excel(bio, sheet_name=0, engine="openpyxl", dtype=str)
            df.columns = [str(c).strip() for c in df.columns]
            df = df.dropna(how="all")
            df = df.loc[:, ~df.columns.astype(str).str.match(r"^Unnamed")]
            return df, raw, filename
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"XLSX parse failed: {e}")

    if name.endswith((".csv", ".tsv")):
        return _read_csv_smart(raw), raw, filename

    raise HTTPException(status_code=400, detail="Upload must be a .csv/.tsv or .xlsx file")


def _to_float(v: object) -> Optional[float]:
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() in {"nan", "none"} or s in {"—", "-", "nm", "NM"}:
        return None

    s = s.replace("−", "-").replace("–", "-")

    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg = True
        s = s[1:-1].strip()

    s = s.replace("$", "").replace(",", "").strip()
    if s.startswith("+"):
        s = s[1:].strip()
    s = s.replace("%", "").strip()

    try:
        x = float(s)
        return -x if neg else x
    except Exception:
        return None


def _clean_symbol(raw_sym: str) -> str:
    s = (raw_sym or "").replace("\u00A0", " ").strip().upper()
    if not s:
        return ""
    s = re.sub(r"[^A-Z0-9\.\-]", "", s)
    return s.strip()


def _canon_symbol(raw_sym: str) -> str:
    s = _clean_symbol(raw_sym)
    return s.replace("-", ".")


def _looks_like_symbol(sym: str) -> bool:
    if not sym:
        return False
    return bool(TICKER_RE.fullmatch(sym.strip().upper()))


def _file_kind(k: str) -> str:
    k = (k or "").strip().lower()
    if k in {"fundamentals", "fundamental", "full"}:
        return "fundamentals"
    if k in {"factors", "factor", "grades"}:
        return "factors"
    return "unknown"


def _pick_cols_common(df: pd.DataFrame) -> dict[str, Optional[str]]:
    def pick(exact: str, contains: list[str]) -> Optional[str]:
        return _find_col_exact(df, exact) or _find_col_contains(df, contains)

    return {
        "rank": pick("Rank", ["rank"]),
        "symbol": pick("Symbol", ["symbol", "ticker"]),
        "company_name": pick("Company Name", ["company name", "company", "name"]),
        "price": pick("Price", ["price"]),
        "change_pct": pick("Change %", ["change %", "chg", "change"]),
        "quant_rating": pick("Quant Rating", ["quant rating", "quant"]),
        "sa_analyst_ratings": pick("SA Analyst Ratings", ["sa analyst"]),
    }


def _pick_cols_fundamentals(df: pd.DataFrame) -> dict[str, Optional[str]]:
    base = _pick_cols_common(df)

    def pick(exact: str, contains: list[str]) -> Optional[str]:
        return _find_col_exact(df, exact) or _find_col_contains(df, contains)

    base.update(
        {
            "sector_industry": pick("Sector & Industry", ["sector", "industry"]),
            "market_cap": pick("Market Cap", ["market cap"]),
            "pe_ttm": pick("P/E TTM", ["p/e", "pe ttm", "p/e ttm"]),
            "net_income_ttm": pick("NET Income TTM", ["net income"]),
            "yield_fwd": pick("Yield FWD", ["yield fwd", "yield"]),
            "perf_1m": pick("1M Perf", ["1m perf", "1m"]),
            "perf_6m": pick("6M Perf", ["6m perf", "6m"]),
            "ebitda_fwd": pick("EBITDA FWD", ["ebitda fwd", "ebitda"]),
            "low_52w": pick("52W Low", ["52w low"]),
            "high_52w": pick("52W High", ["52w high"]),
        }
    )
    return base


def _pick_cols_factors(df: pd.DataFrame) -> dict[str, Optional[str]]:
    base = _pick_cols_common(df)

    def pick(exact: str, contains: list[str]) -> Optional[str]:
        return _find_col_exact(df, exact) or _find_col_contains(df, contains)

    base.update(
        {
            "wall_street_ratings": pick("Wall Street Ratings", ["wall street"]),
            "valuation_grade": pick("Valuation", ["valuation"]),
            "growth_grade": pick("Growth", ["growth"]),
            "profitability_grade": pick("Profitability", ["profitability"]),
            "momentum_grade": pick("Momentum", ["momentum"]),
            "eps_rev_grade": pick("EPS Rev.", ["eps rev", "eps"]),
        }
    )
    return base

def _row_common(row: dict[str, Any], cols: dict[str, Optional[str]]) -> Optional[dict[str, Any]]:
    sym_raw = str(row.get(cols["symbol"], "")).strip() if cols.get("symbol") else ""
    sym = _clean_symbol(sym_raw)
    sym_canon = _canon_symbol(sym_raw)

    if not _looks_like_symbol(sym) and not _looks_like_symbol(sym_canon):
        return None

    rank_f = _to_float(row.get(cols["rank"])) if cols.get("rank") else None
    rank_i = int(rank_f) if rank_f is not None else None

    company = (str(row.get(cols["company_name"], "")).strip() if cols.get("company_name") else "") or None

    out: dict[str, Any] = {
        "rank": rank_i,
        "symbol": sym,
        "symbol_canon": sym_canon,
        "company_name": company,
        "price": _to_float(row.get(cols["price"])) if cols.get("price") else None,
        "change_pct": _to_float(row.get(cols["change_pct"])) if cols.get("change_pct") else None,
        "quant_rating": _to_float(row.get(cols["quant_rating"])) if cols.get("quant_rating") else None,
        "sa_analyst_ratings": _to_float(row.get(cols["sa_analyst_ratings"])) if cols.get("sa_analyst_ratings") else None,
    }
    return out


def _row_fundamentals(row: dict[str, Any], cols: dict[str, Optional[str]], as_of: str) -> Optional[dict[str, Any]]:
    base = _row_common(row, cols)
    if base is None:
        return None

    def s(col_key: str) -> Optional[str]:
        c = cols.get(col_key)
        if not c:
            return None
        v = str(row.get(c, "")).strip()
        return v if v else None

    doc = dict(base)
    doc.update(
        {
            "sector_industry": s("sector_industry"),
            "market_cap": s("market_cap"),
            "pe_ttm": s("pe_ttm"),
            "net_income_ttm": s("net_income_ttm"),
            "yield_fwd": s("yield_fwd"),
            "perf_1m": s("perf_1m"),
            "perf_6m": s("perf_6m"),
            "ebitda_fwd": s("ebitda_fwd"),
            "low_52w": _to_float(row.get(cols["low_52w"])) if cols.get("low_52w") else None,
            "high_52w": _to_float(row.get(cols["high_52w"])) if cols.get("high_52w") else None,
            "report_type": "fundamentals",
            "as_of": as_of,
        }
    )
    return doc


def _row_factors(row: dict[str, Any], cols: dict[str, Optional[str]], as_of: str) -> Optional[dict[str, Any]]:
    base = _row_common(row, cols)
    if base is None:
        return None

    def s(col_key: str) -> Optional[str]:
        c = cols.get(col_key)
        if not c:
            return None
        v = str(row.get(c, "")).strip()
        return v if v else None

    doc = dict(base)
    doc.update(
        {
            "wall_street_ratings": _to_float(row.get(cols["wall_street_ratings"])) if cols.get("wall_street_ratings") else None,
            "valuation_grade": s("valuation_grade"),
            "growth_grade": s("growth_grade"),
            "profitability_grade": s("profitability_grade"),
            "momentum_grade": s("momentum_grade"),
            "eps_rev_grade": s("eps_rev_grade"),
            "report_type": "factors",
            "as_of": as_of,
        }
    )
    return doc


class UploadResp(BaseModel):
    as_of: str
    kind: str
    file_id: str
    inserted_rows: int
    sha256: str
    columns_detected: dict[str, Optional[str]]


class ResearchLatestResp(BaseModel):
    asOf: str
    rows: list[dict[str, Any]]


class FileItem(BaseModel):
    file_id: str
    as_of: str
    kind: str
    filename: str
    inserted_rows: int
    uploaded_at: datetime



async def _insert_upload(
    *,
    file: UploadFile,
    as_of: str,
    kind: str,
) -> UploadResp:
    as_of = require_iso_date(as_of)

    df, raw, filename = await _read_upload_table(file)
    sha256 = hashlib.sha256(raw).hexdigest()

    kind2 = _file_kind(kind)
    if kind2 not in {"fundamentals", "factors"}:
        raise HTTPException(status_code=400, detail="kind must be fundamentals or factors")

    cols = _pick_cols_fundamentals(df) if kind2 == "fundamentals" else _pick_cols_factors(df)
    if not cols.get("symbol"):
        raise HTTPException(status_code=400, detail=f"Could not find Symbol column. Columns={list(df.columns)}")

    rows_raw = df.fillna("").to_dict(orient="records")

    row_docs: list[dict[str, Any]] = []
    for r in rows_raw:
        if not isinstance(r, dict):
            continue
        d = _row_fundamentals(r, cols, as_of) if kind2 == "fundamentals" else _row_factors(r, cols, as_of)
        if d is None:
            continue
        d["raw_row"] = r
        row_docs.append(d)

    if not row_docs:
        raise HTTPException(
            status_code=400,
            detail={"error": "No valid rows parsed (could not detect tickers)", "columns": list(df.columns), "picked": cols},
        )

    db = get_db()
    files = db["sa_files"]
    sa_rows = db["sa_rows"]

    uploaded_at = utcnow()

    await sa_rows.delete_many({"as_of": as_of, "report_type": kind2})

    file_doc = {
        "as_of": as_of,
        "kind": kind2,
        "filename": filename,
        "sha256": sha256,
        "bytes": len(raw),
        "inserted_rows": len(row_docs),
        "picked_columns": cols,
        "uploaded_at": uploaded_at,
        "created_at": uploaded_at,
    }

    await files.delete_many({"as_of": as_of, "kind": kind2})

    ins = await files.insert_one(file_doc)
    file_id = str(ins.inserted_id)

    for d in row_docs:
        d["file_id"] = file_id
        d["uploaded_at"] = uploaded_at
        d["created_at"] = uploaded_at
        d["join_key"] = f"{as_of}:{d.get('symbol_canon') or d.get('symbol')}"

    await sa_rows.insert_many(row_docs, ordered=False)

    return UploadResp(
        as_of=as_of,
        kind=kind2,
        file_id=file_id,
        inserted_rows=len(row_docs),
        sha256=sha256,
        columns_detected=cols,
    )


@router.post("/upload/fundamentals", response_model=UploadResp)
async def upload_fundamentals(
    req: Request,
    file: UploadFile = File(...),
    as_of: str = Query(..., description="YYYY-MM-DD (the report date)"),
):
    require_admin(req)
    return await _insert_upload(file=file, as_of=as_of, kind="fundamentals")


@router.post("/upload/factors", response_model=UploadResp)
async def upload_factors(
    req: Request,
    file: UploadFile = File(...),
    as_of: str = Query(..., description="YYYY-MM-DD (the report date)"),
):
    require_admin(req)
    return await _insert_upload(file=file, as_of=as_of, kind="factors")


@router.get("/latest", response_model=ResearchLatestResp)
async def latest_research(
    limit: int = Query(500, ge=1, le=5000),
    kind: str = Query("", description="optional: fundamentals | factors | (blank for merged)"),
):
    db = get_db()
    files = db["sa_files"]
    sa_rows = db["sa_rows"]

    fund_doc = await files.find_one(
        {"kind": "fundamentals"},
        sort=[("as_of", -1), ("uploaded_at", -1)],
        projection={"as_of": 1},
    )
    if not fund_doc:
        return {"asOf": "—", "rows": []}

    fund_asof = str(fund_doc["as_of"])

    fact_doc = await files.find_one(
        {"kind": "factors", "as_of": fund_asof},
        sort=[("uploaded_at", -1)],
        projection={"as_of": 1},
    )
    if not fact_doc:
        fact_doc = await files.find_one(
            {"kind": "factors", "as_of": {"$lte": fund_asof}},
            sort=[("as_of", -1), ("uploaded_at", -1)],
            projection={"as_of": 1},
        )

    fact_asof = str(fact_doc["as_of"]) if fact_doc else None

    kind_q = _file_kind(kind) if kind else ""
    if kind and kind_q == "unknown":
        raise HTTPException(status_code=400, detail="kind must be fundamentals or factors")

    if kind_q in {"fundamentals", "factors"}:
        q: dict[str, Any] = {"as_of": fund_asof, "report_type": kind_q}
        cur = (
            sa_rows.find(q, projection={"_id": 0, "raw_row": 0})
            .sort([("uploaded_at", -1), ("rank", 1), ("symbol", 1)])
            .limit(limit)
        )
        rows = await cur.to_list(length=limit)

        seen: set[str] = set()
        deduped: list[dict[str, Any]] = []
        for r in rows:
            sym = str(r.get("symbol") or "").upper().strip()
            if not sym or sym in seen:
                continue
            seen.add(sym)
            deduped.append(r)

        return {"asOf": fund_asof, "rows": deduped[:limit]}

    fund_q = {"as_of": fund_asof, "report_type": "fundamentals"}
    fund_docs = await (
        sa_rows.find(fund_q, projection={"_id": 0, "raw_row": 0})
        .sort([("uploaded_at", -1), ("rank", 1), ("symbol", 1)])
        .limit(20000)
        .to_list(length=20000)
    )

    fact_docs = []
    if fact_asof:
        fact_q = {"as_of": fact_asof, "report_type": "factors"}
        fact_docs = await (
            sa_rows.find(fact_q, projection={"_id": 0, "raw_row": 0})
            .sort([("uploaded_at", -1), ("rank", 1), ("symbol", 1)])
            .limit(20000)
            .to_list(length=20000)
        )

    fund_map: dict[str, dict[str, Any]] = {}
    for d in fund_docs:
        k = str(d.get("symbol_canon") or d.get("symbol") or "").upper().strip()
        if k and k not in fund_map:
            fund_map[k] = d

    fact_map: dict[str, dict[str, Any]] = {}
    for d in fact_docs:
        k = str(d.get("symbol_canon") or d.get("symbol") or "").upper().strip()
        if k and k not in fact_map:
            fact_map[k] = d

    factor_only_keys = {
        "wall_street_ratings",
        "valuation_grade",
        "growth_grade",
        "profitability_grade",
        "momentum_grade",
        "eps_rev_grade",
    }

    syms = sorted(set(fund_map.keys()) | set(fact_map.keys()))
    merged: list[dict[str, Any]] = []

    for sym in syms:
        a = fund_map.get(sym)
        b = fact_map.get(sym)

        if a and b:
            m = dict(a)
            for k in factor_only_keys:
                m[k] = b.get(k)
            m["report_type"] = "merged"
            m["factors_as_of"] = fact_asof
            m["factors_stale"] = (fact_asof != fund_asof)
            merged.append(m)
        elif a:
            m = dict(a)
            m["report_type"] = "fundamentals"
            m["factors_as_of"] = fact_asof
            m["factors_stale"] = True
            merged.append(m)
        else:
            m = dict(b)
            m["report_type"] = "factors"
            merged.append(m)

    def _sort_key(x: dict[str, Any]) -> tuple:
        r = x.get("rank")
        rr = r if isinstance(r, int) else 10**9
        return (rr, str(x.get("symbol") or ""))

    merged.sort(key=_sort_key)
    merged = merged[:limit]

    return {"asOf": fund_asof, "rows": merged}


@router.get("/files", response_model=list[FileItem])
async def list_research_files(limit: int = Query(50, ge=1, le=500)):
    db = get_db()
    files = db["sa_files"]

    cur = (
        files.find(
            {},
            projection={"_id": 1, "as_of": 1, "kind": 1, "filename": 1, "inserted_rows": 1, "uploaded_at": 1},
        )
        .sort([("uploaded_at", -1)])
        .limit(limit)
    )
    docs = await cur.to_list(length=limit)

    out: list[FileItem] = []
    for d in docs:
        out.append(
            FileItem(
                file_id=str(d.get("_id") or ""),
                as_of=str(d.get("as_of") or ""),
                kind=str(d.get("kind") or "unknown"),
                filename=str(d.get("filename") or ""),
                inserted_rows=int(d.get("inserted_rows") or 0),
                uploaded_at=(d.get("uploaded_at") or utcnow()),
            )
        )
    return out