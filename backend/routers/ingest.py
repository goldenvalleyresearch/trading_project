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

from core.security import decode_token, require_token_type, get_cookie_tokens
from core.db import get_db

router = APIRouter(prefix="/api/ingest", tags=["Ingest"])

ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TICKER_RE = re.compile(r"^[A-Z]{1,7}(?:\.[A-Z]{1,3})?$")


# --------------------
# AUTH (admin-only)
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


def _find_col_contains(
    df: pd.DataFrame,
    contains_any: list[str],
    *,
    reject_any: list[str] | None = None,
) -> Optional[str]:
    reject_any = reject_any or []
    for c in df.columns:
        nc = _norm(c)
        if any(_norm(k) in nc for k in contains_any):
            if any(_norm(r) in nc for r in reject_any):
                continue
            return c
    return None


def _to_float(v) -> Optional[float]:
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() in {"nan", "none"} or s in {"—", "-", "NM"}:
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


def _safe_float(x, default: float = 0.0) -> float:
    try:
        if x is None:
            return float(default)
        return float(x)
    except Exception:
        return float(default)


def _is_disclaimer_row(sym: str, desc: str) -> bool:
    blob = f"{sym} {desc}".strip().lower()
    if not blob:
        return True
    bad_phrases = [
        "provided to you solely for your use",
        "not for distribution",
        "informational purposes only",
        "not intended to provide advice",
        "should not be used in place of your account statements",
        "for more information on the data included",
        "brokerage services are provided",
        "members sipc",
        "fidelity.com",
        "date downloaded",
        "custody and other services provided",
    ]
    return any(p in blob for p in bad_phrases)


def _clean_symbol(raw_sym: str) -> str:
    s = (raw_sym or "").replace("\u00A0", " ").strip().upper()
    if not s:
        return ""
    if s.endswith("**"):
        return re.sub(r"\s+", "", s)
    s = re.sub(r"[^A-Z0-9\.\*]", "", s)
    return s.strip()


def _looks_like_symbol(sym: str) -> bool:
    if not sym:
        return False
    s = sym.strip().upper()
    if s.endswith("**"):
        return True
    return bool(TICKER_RE.fullmatch(s))


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
    preview_lines = text.splitlines()[:300]
    preview = "\n".join(preview_lines)

    delim = _sniff_delim(preview)

    header_idx: int | None = None
    for i, line in enumerate(preview_lines[:180]):
        lo = line.lower()
        if ("symbol" in lo) and ("quantity" in lo):
            header_idx = i
            break

    def read_with(sep: str, skip: int = 0) -> pd.DataFrame:
        return pd.read_csv(
            io.BytesIO(raw),
            sep=sep,
            skiprows=skip,
            engine="python",
            dtype=str,
            keep_default_na=False,
        )

    df = read_with(delim, skip=(header_idx or 0))

    if len(df.columns) == 1:
        df_tab = read_with("\t", skip=(header_idx or 0))
        df = df_tab if len(df_tab.columns) > 1 else read_with(",", skip=(header_idx or 0))

    col_lc = [str(c).strip().lower() for c in df.columns]
    if ("symbol" not in col_lc) and (header_idx is not None):
        df0 = pd.read_csv(
            io.BytesIO(raw),
            sep=delim,
            header=None,
            engine="python",
            dtype=str,
            keep_default_na=False,
        )
        hdr = df0.iloc[header_idx].astype(str).tolist()
        df = df0.iloc[header_idx + 1 :].copy()
        df.columns = [str(x).strip() for x in hdr]

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
            try:
                df = pd.read_excel(bio, sheet_name="Summary", engine="openpyxl", dtype=str)
            except Exception:
                bio.seek(0)
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


def _col_score_symbol(df: pd.DataFrame, col: str) -> int:
    score = 0
    for v in df[col].head(80).tolist():
        s = _clean_symbol(str(v))
        if not s:
            continue
        if s.endswith("**") or TICKER_RE.match(s):
            score += 4
        elif _looks_like_symbol(s):
            score += 2
        if len(s) > 12:
            score -= 2
    return score


def _col_score_qty(df: pd.DataFrame, col: str) -> int:
    score = 0
    for v in df[col].head(80).tolist():
        x = _to_float(v)
        if x is None:
            continue
        if abs(x) <= 1_000_000:
            score += 3
        else:
            score -= 1
    return score


def _col_score_price(df: pd.DataFrame, col: str) -> int:
    score = 0
    neg = 0
    n = 0
    for v in df[col].head(80).tolist():
        x = _to_float(v)
        if x is None:
            continue
        n += 1
        if x < 0:
            neg += 1
        if 0 <= x <= 100_000:
            score += 2
    if n > 0 and (neg / n) > 0.15:
        score -= 20
    return score


def _col_score_value(df: pd.DataFrame, col: str) -> int:
    score = 0
    neg = 0
    n = 0
    for v in df[col].head(80).tolist():
        x = _to_float(v)
        if x is None:
            continue
        n += 1
        if x < 0:
            neg += 1
        if abs(x) <= 50_000_000:
            score += 2
    if n > 0 and (neg / n) > 0.25:
        score -= 10
    return score


def _pick_best(df: pd.DataFrame, candidates: list[str], scorer) -> Optional[str]:
    best = None
    best_score = -(10**9)
    for c in candidates:
        if not c or c not in df.columns:
            continue
        s = scorer(df, c)
        if s > best_score:
            best_score = s
            best = c
    return best


def _pick_columns_for_positions(df: pd.DataFrame) -> dict[str, Optional[str]]:
    def uniq(cols):
        out = []
        for c in cols:
            if c and c in df.columns and c not in out:
                out.append(c)
        return out

    col_symbol = _find_col_exact(df, "Symbol")
    col_desc = _find_col_exact(df, "Description")
    col_qty = _find_col_exact(df, "Quantity")
    col_price = _find_col_exact(df, "Last Price")
    col_value = _find_col_exact(df, "Current Value")

    col_day = _find_col_exact(df, "Today's Gain/Loss Dollar")
    col_total = _find_col_exact(df, "Total Gain/Loss Dollar")
    col_weight = _find_col_exact(df, "Percent Of Account")
    col_avg = _find_col_exact(df, "Average Cost Basis")
    col_cost = _find_col_exact(df, "Cost Basis Total")

    if not col_symbol:
        sym_matches = uniq([_find_col_contains(df, ["symbol", "ticker"], reject_any=["cusip"])]) or list(df.columns)
        col_symbol = _pick_best(df, sym_matches, _col_score_symbol)

    if not col_qty:
        qty_matches = uniq([_find_col_contains(df, ["quantity", "qty", "shares"], reject_any=["%", "percent"])]) or list(df.columns)
        col_qty = _pick_best(df, qty_matches, _col_score_qty)

    if not col_price:
        price_matches = uniq([
            _find_col_contains(df, ["last price"], reject_any=["change", "gain", "loss", "percent", "%"]),
            _find_col_contains(df, ["price"], reject_any=["change", "gain", "loss", "percent", "%"]),
        ]) or list(df.columns)
        col_price = _pick_best(df, price_matches, _col_score_price)

    if not col_value:
        value_matches = uniq([
            _find_col_contains(df, ["current value", "market value", "position value"], reject_any=["change", "gain", "loss", "percent", "%"]),
            _find_col_contains(df, ["value"], reject_any=["change", "gain", "loss", "percent", "%"]),
        ]) or list(df.columns)
        col_value = _pick_best(df, value_matches, _col_score_value)

    if not col_desc:
        col_desc = _find_col_contains(df, ["description", "security"], reject_any=["account", "account name"])

    if not col_day:
        col_day = _find_col_contains(df, ["today", "gain/loss dollar"], reject_any=["percent", "%"])

    if not col_total:
        col_total = _find_col_contains(df, ["total gain/loss dollar"], reject_any=["percent", "%"])

    if not col_weight:
        col_weight = _find_col_contains(df, ["percent of account", "weight"], reject_any=[])

    if not col_avg:
        col_avg = _find_col_contains(df, ["average cost basis"], reject_any=["account"])

    if not col_cost:
        col_cost = _find_col_contains(df, ["cost basis total", "cost basis"], reject_any=["average", "account"])

    return {
        "symbol": col_symbol,
        "desc": col_desc,
        "qty": col_qty,
        "price": col_price,
        "value": col_value,
        "cost": col_cost,
        "avg": col_avg,
        "day": col_day,
        "total": col_total,
        "weight": col_weight,
    }


def _ticker_like_rate(series: pd.Series) -> float:
    vals = series.head(80).tolist()
    good = 0
    seen = 0
    for v in vals:
        s = _clean_symbol(str(v))
        if not s:
            continue
        seen += 1
        if _looks_like_symbol(s):
            good += 1
    return (good / seen) if seen else 0.0


def _repair_shift_if_needed(df: pd.DataFrame, cols: dict[str, Optional[str]]) -> dict[str, Optional[str]]:
    sym_col = cols.get("symbol")
    acct_col = "Account Name" if "Account Name" in df.columns else None
    if not sym_col or not acct_col:
        return cols

    sym_rate = _ticker_like_rate(df[sym_col])
    acct_rate = _ticker_like_rate(df[acct_col])

    if sym_rate < 0.15 and acct_rate > 0.40:
        repaired = dict(cols)
        repaired["symbol"] = "Account Name"
        repaired["desc"] = "Symbol" if "Symbol" in df.columns else cols.get("desc")
        repaired["qty"] = "Description" if "Description" in df.columns else cols.get("qty")
        repaired["price"] = "Quantity" if "Quantity" in df.columns else cols.get("price")
        repaired["value"] = "Last Price Change" if "Last Price Change" in df.columns else cols.get("value")
        repaired["day"] = "Current Value" if "Current Value" in df.columns else cols.get("day")
        repaired["total"] = "Today's Gain/Loss Percent" if "Today's Gain/Loss Percent" in df.columns else cols.get("total")
        repaired["weight"] = "Total Gain/Loss Percent" if "Total Gain/Loss Percent" in df.columns else cols.get("weight")
        repaired["cost"] = "Percent Of Account" if "Percent Of Account" in df.columns else cols.get("cost")
        repaired["avg"] = "Cost Basis Total" if "Cost Basis Total" in df.columns else cols.get("avg")
        return repaired

    return cols


def _pos_map(positions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for p in positions or []:
        t = (p.get("ticker") or p.get("symbol") or "").strip().upper()
        if not t:
            continue
        out[t] = p
    return out


async def _upsert_receipt_for_day(
    *,
    db,
    as_of: str,
    filename: str,
    sha256: str,
    positions: list[dict[str, Any]],
) -> dict[str, Any]:
    snapshots = db["snapshots"]
    receipts = db["receipts"]

    prev = await snapshots.find_one(
        {"as_of": {"$lt": as_of}},
        sort=[("as_of", -1)],
        projection={"_id": 0, "as_of": 1, "positions": 1},
    )

    cur_map = _pos_map(positions)
    prev_map = _pos_map((prev or {}).get("positions") or [])

    sold: list[dict[str, Any]] = []
    sold_value_est = 0.0

    for ticker, prev_pos in prev_map.items():
        prev_qty = _safe_float(prev_pos.get("quantity"), 0.0)
        cur_qty = _safe_float((cur_map.get(ticker) or {}).get("quantity"), 0.0)
        delta = cur_qty - prev_qty
        if delta >= 0:
            continue

        qty_sold = abs(delta)
        price = _safe_float((cur_map.get(ticker) or {}).get("last_price"), 0.0)
        if price <= 0:
            price = _safe_float(prev_pos.get("last_price"), 0.0)

        value = float(qty_sold) * float(price)
        sold_value_est += value

        sold.append(
            {
                "ticker": ticker,
                "side": "SELL",
                "qty": qty_sold,
                "price_est": price,
                "value_est": value,
                "from_qty": prev_qty,
                "to_qty": cur_qty,
            }
        )

    sold.sort(key=lambda x: float(x.get("value_est") or 0.0), reverse=True)

    receipt_doc = {
        "date": as_of,
        "prev_date": (prev or {}).get("as_of"),
        "source": {"filename": filename, "sha256": sha256},
        "positions_count": len(positions),
        "sold": sold,
        "sold_count": len(sold),
        "sold_value_est": float(sold_value_est),
        "updated_at": utcnow(),
    }

    await receipts.update_one(
        {"date": as_of},
        {"$set": receipt_doc, "$setOnInsert": {"created_at": utcnow()}},
        upsert=True,
    )

    return receipt_doc


class IngestPositionsResp(BaseModel):
    as_of: str
    positions_written: int
    sha256: str
    receipt: dict[str, Any]


class IngestPerformanceResp(BaseModel):
    rows_written: int



@router.post("/positions")
async def ingest_positions(
    req: Request,
    file: UploadFile = File(...),
    as_of: str = Query(..., description="Snapshot date YYYY-MM-DD"),
    debug: bool = Query(False),
):
    require_admin(req)

    as_of = require_iso_date(as_of)
    df, raw, filename = await _read_upload_table(file)

    raw_sha256 = hashlib.sha256(raw).hexdigest()
    raw_size = len(raw)

    cols = _repair_shift_if_needed(df, _pick_columns_for_positions(df))

    col_symbol = cols["symbol"]
    col_desc = cols["desc"]
    col_qty = cols["qty"]
    col_price = cols["price"]
    col_value = cols["value"]
    col_cost = cols["cost"]
    col_avg = cols["avg"]
    col_day = cols["day"]
    col_total = cols["total"]
    col_weight = cols["weight"]

    if not col_symbol:
        raise HTTPException(status_code=400, detail=f"Missing Symbol column after repair. Columns: {list(df.columns)}")
    if not col_qty:
        raise HTTPException(status_code=400, detail=f"Missing Quantity column after repair. Columns: {list(df.columns)}")

    positions: list[dict[str, Any]] = []
    pending_amount = 0.0
    debug_pending_rows: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        sym_raw = str(row.get(col_symbol, "")).strip()
        desc_raw = str(row.get(col_desc, "")).strip() if col_desc else ""

        sym_norm = sym_raw.strip().upper()

        # ---- CAPTURE PENDING ACTIVITY (Fidelity row) ----
        # Fidelity sometimes puts "Pending activity" in the symbol column OR "PENDING" as a symbol.
        # Treat both as pending and DO NOT ingest as a position.
        if sym_norm == "PENDING" or "pending" in sym_raw.lower():
            raw_val = row.get(col_value) if col_value else None
            pending_num = _to_float(raw_val) or 0.0
            pending_amount += float(pending_num)

            if debug:
                debug_pending_rows.append(row.to_dict())

            continue
        # ---- END PENDING CAPTURE ----

        sym = _clean_symbol(sym_raw)

        if _is_disclaimer_row(sym, desc_raw):
            continue
        if not _looks_like_symbol(sym):
            continue

        qty = _to_float(row.get(col_qty)) or 0.0
        price = _to_float(row.get(col_price)) if col_price else None
        value = _to_float(row.get(col_value)) if col_value else None
        avg = _to_float(row.get(col_avg)) if col_avg else None
        day = _to_float(row.get(col_day)) if col_day else None
        pnl = _to_float(row.get(col_total)) if col_total else None
        weight = _to_float(row.get(col_weight)) if col_weight else None
        cost = _to_float(row.get(col_cost)) if col_cost else None

        pos: dict[str, Any] = {
            "ticker": sym,
            "symbol": sym,
            "name": desc_raw or "—",
            "quantity": float(qty),
            "is_strict_ticker": bool(sym.endswith("**") or TICKER_RE.match(sym)),
            "qty": float(qty),
        }

        if price is not None:
            pos["last_price"] = float(price)
            pos["price"] = float(price)
        if value is not None:
            pos["market_value"] = float(value)
            pos["value"] = float(value)
        if avg is not None:
            pos["avg_cost"] = float(avg)
            pos["avg"] = float(avg)
        if cost is not None:
            pos["cost_value"] = float(cost)
        if day is not None:
            pos["todays_gain_loss"] = float(day)
            pos["day"] = float(day)
        if pnl is not None:
            pos["total_gain_loss"] = float(pnl)
            pos["pnl"] = float(pnl)
        if weight is not None:
            pos["weight_pct"] = float(weight)
            pos["weight"] = float(weight)

        positions.append(pos)

    if not positions:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Parsed zero positions",
                "picked_after_repair": cols,
                "columns": list(df.columns),
                "hint": "POST /api/ingest/positions/debug to inspect mapping",
            },
        )

    # IMPORTANT:
    # total_value should match Fidelity total (includes SPAXX** line)
    # pending is NOT a position line in our data, so add it here.
    positions_total_value = float(sum(float(p.get("market_value") or p.get("value") or 0) for p in positions))
    total_value = float(positions_total_value + float(pending_amount))

    non_cash_positions_value = float(
        sum(
            float(p.get("market_value") or p.get("value") or 0)
            for p in positions
            if not str(p.get("ticker", "")).endswith("**")
        )
    )

    todays_pnl_total = float(sum(float(p.get("todays_gain_loss") or p.get("day") or 0) for p in positions))

    db = get_db()
    snapshots = db["snapshots"]

    doc = {
        "as_of": as_of,
        "positions": positions,
        "non_cash_positions_value": non_cash_positions_value,
        "total_value": total_value,
        "todays_pnl_total": todays_pnl_total,
        "cash_spaxx": 0.0,
        "pending_amount": float(pending_amount),
        "source": {
            "kind": "positions_upload",
            "filename": filename,
            "sha256": raw_sha256,
            "bytes": raw_size,
            "ingested_at": utcnow(),
        },
        "updated_at": utcnow(),
    }

    await snapshots.update_one(
        {"as_of": as_of},
        {"$set": doc, "$setOnInsert": {"created_at": utcnow()}},
        upsert=True,
    )

    receipt = await _upsert_receipt_for_day(
        db=db,
        as_of=as_of,
        filename=filename,
        sha256=raw_sha256,
        positions=positions,
    )

    resp: dict[str, Any] = {
        "as_of": as_of,
        "positions_written": len(positions),
        "sha256": raw_sha256,
        "receipt": receipt,
    }

    if debug:
        resp["debug_picked_after_repair"] = cols
        resp["debug_pending_amount"] = float(pending_amount)
        resp["debug_positions_total_value"] = float(positions_total_value)
        resp["debug_total_value_including_pending"] = float(total_value)
        resp["debug_positions_preview"] = positions[:10]
        resp["debug_df_head"] = df.head(10).to_dict(orient="records")
        resp["debug_pending_rows"] = debug_pending_rows

    return resp


@router.post("/positions/debug")
async def debug_positions(
    req: Request,
    file: UploadFile = File(...),
):
    require_admin(req)

    df, raw, filename = await _read_upload_table(file)
    picked = _pick_columns_for_positions(df)
    repaired = _repair_shift_if_needed(df, picked)
    return {
        "filename": filename,
        "columns": list(df.columns),
        "picked": picked,
        "picked_after_repair": repaired,
        "head": df.head(10).to_dict(orient="records"),
    }


# --------------------
# endpoints: PERFORMANCE
# --------------------

# --------------------
# endpoints: ACTIVITY / TRADES
# --------------------

class IngestActivityResp(BaseModel):
    rows_written: int
    rows_skipped: int
    rows_total_seen: int


def _parse_run_date_cell(v: Any) -> Optional[str]:
    """
    Returns YYYY-MM-DD from either:
      - already-ISO strings
      - M/D/YYYY strings
      - pandas / excel date-like values
    """
    if v is None:
        return None

    # pandas Timestamp / datetime
    if isinstance(v, datetime):
        return v.date().isoformat()

    s = str(v).strip()
    if not s:
        return None

    # already ISO
    if ISO_DATE_RE.match(s[:10]):
        return s[:10]

    # M/D/YYYY
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        mm, dd, yy = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mm <= 12 and 1 <= dd <= 31:
            return f"{yy:04d}-{mm:02d}-{dd:02d}"

    # sometimes excel-ish like "2026-01-23 00:00:00"
    if len(s) >= 10 and ISO_DATE_RE.match(s[:10]):
        return s[:10]

    return None


def _action_side(action: str) -> Optional[str]:
    a = (action or "").strip().lower()
    if a.startswith("you bought"):
        return "BUY"
    if a.startswith("you sold"):
        return "SELL"
    return None


@router.post("/activity", response_model=IngestActivityResp)
async def ingest_activity(
    req: Request,
    file: UploadFile = File(...),
):
    require_admin(req)

    df, raw, filename = await _read_upload_table(file)

    # Try to locate columns (your screenshot headers)
    col_run_date = _find_col_contains(df, ["run date"]) or _find_col_exact(df, "Run Date") or _find_col_contains(df, ["date"])
    col_action = _find_col_contains(df, ["action"]) or _find_col_exact(df, "Action")
    col_symbol = _find_col_contains(df, ["symbol", "ticker"]) or _find_col_exact(df, "Symbol")
    col_desc = _find_col_contains(df, ["description"]) or _find_col_exact(df, "Description")
    col_price = _find_col_contains(df, ["price"]) or _find_col_exact(df, "Price ($)") or _find_col_exact(df, "Price")
    col_qty = _find_col_contains(df, ["quantity", "qty", "shares"]) or _find_col_exact(df, "Quantity")
    col_fees = _find_col_contains(df, ["fees"]) or _find_col_exact(df, "Fees ($)") or _find_col_exact(df, "Fees")
    col_settle = _find_col_contains(df, ["settlement"]) or _find_col_exact(df, "Settlement Date")

    if not col_run_date or not col_action or not col_symbol:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Missing required columns for activity ingest",
                "need": ["Run Date", "Action", "Symbol"],
                "found_columns": list(df.columns),
                "picked": {
                    "run_date": col_run_date,
                    "action": col_action,
                    "symbol": col_symbol,
                    "price": col_price,
                    "qty": col_qty,
                    "fees": col_fees,
                    "settlement": col_settle,
                },
            },
        )

    db = get_db()
    col = db["activity_trades"]

    raw_sha256 = hashlib.sha256(raw).hexdigest()

    rows_total = 0
    written = 0
    skipped = 0

    for _, r in df.iterrows():
        rows_total += 1

        action = str(r.get(col_action, "")).strip()
        side = _action_side(action)
        if not side:
            skipped += 1
            continue

        trade_date = _parse_run_date_cell(r.get(col_run_date))
        if not trade_date:
            skipped += 1
            continue

        sym = _clean_symbol(str(r.get(col_symbol, "")).strip())
        if not sym or not _looks_like_symbol(sym):
            skipped += 1
            continue

        desc = str(r.get(col_desc, "")).strip() if col_desc else ""
        price = _to_float(r.get(col_price)) if col_price else None
        qty = _to_float(r.get(col_qty)) if col_qty else None
        fees = _to_float(r.get(col_fees)) if col_fees else None
        settle_date = _parse_run_date_cell(r.get(col_settle)) if col_settle else None

        if qty is None or qty == 0:
            skipped += 1
            continue

        # Normalize qty sign: store as positive, side indicates direction
        qty_abs = abs(float(qty))

        # Value estimate (helpful even if price is missing)
        value_est = (float(price) * qty_abs) if isinstance(price, (int, float)) else None

        # Deterministic trade_id to dedupe re-uploads
        # Include core fields + file hash so it stays stable for same row.
        trade_key = f"{trade_date}|{side}|{sym}|{qty_abs}|{price or ''}|{settle_date or ''}|{action.lower()}"
        trade_id = hashlib.sha256(trade_key.encode("utf-8")).hexdigest()[:24]

        doc = {
            "trade_id": trade_id,
            "trade_date": trade_date,
            "settlement_date": settle_date,
            "side": side,
            "ticker": sym,
            "description": desc or None,
            "qty": qty_abs,
            "price": float(price) if isinstance(price, (int, float)) else None,
            "fees": float(fees) if isinstance(fees, (int, float)) else None,
            "value_est": float(value_est) if isinstance(value_est, (int, float)) else None,

            # source info
            "source": {
                "filename": filename,
                "sha256": raw_sha256,
                "action_raw": action,
            },
            "updated_at": utcnow(),
        }

        res = await col.update_one(
            {"trade_id": trade_id},
            {"$set": doc, "$setOnInsert": {"created_at": utcnow()}},
            upsert=True,
        )

        # count a "write" if it inserted OR modified
        if res.upserted_id is not None or (res.modified_count or 0) > 0:
            written += 1

    return {
        "rows_written": written,
        "rows_skipped": skipped,
        "rows_total_seen": rows_total,
    }




@router.post("/performance", response_model=IngestPerformanceResp)
async def ingest_performance(
    req: Request,
    file: UploadFile = File(...),
):
    require_admin(req)

    df, raw, filename = await _read_upload_table(file)

    # Your current CSV headers (based on screenshot)
    col_date = _find_col_contains(df, ["date"]) or _find_col_exact(df, "Date")
    col_bal = _find_col_contains(df, ["roth balance", "balance", "equity", "value"])

    col_dollar_change = _find_col_contains(df, ["dollar change", "dollar cha", "dollar chg", "dollar"])
    col_roth_ret = _find_col_exact(df, "Roth") or _find_col_contains(df, ["roth"], reject_any=["balance"])
    col_voo_close = _find_col_exact(df, "VOO") or _find_col_contains(df, ["voo"], reject_any=["balance", "ret", "return", "pct", "%"])
    col_qqq_close = _find_col_exact(df, "QQQ") or _find_col_contains(df, ["qqq"], reject_any=["balance", "ret", "return", "pct", "%"])

    if not col_date or not col_bal:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns. Need date and roth balance. Found: {list(df.columns)}",
        )

    def _to_iso_date(raw_s: str) -> Optional[str]:
        s = (raw_s or "").strip()
        if not s:
            return None

        # Skip non-date rows like "TRANSFER"
        if not any(ch.isdigit() for ch in s):
            return None

        # Already ISO
        if ISO_DATE_RE.match(s[:10]):
            return s[:10]

        # Excel-ish "Thursday 9/18/2025" or "9/18/2025"
        parts = s.split()
        candidate = parts[-1] if parts else s

        m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", candidate)
        if not m:
            return None
        mm, dd, yy = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if not (1 <= mm <= 12 and 1 <= dd <= 31):
            return None
        return f"{yy:04d}-{mm:02d}-{dd:02d}"

    def _clamp_ret(x: Optional[float]) -> Optional[float]:
        """
        Returns are DECIMALS in your file:
          0.0197 = +1.97%
         -0.0064 = -0.64%

        We just clamp insane values so one bad row doesn't blow up the chart.
        """
        if x is None:
            return None
        v = float(x)

        # If someone accidentally pastes 1.97 (meaning 197%), that's probably wrong.
        # Clamp, but keep generous bounds.
        if v < -0.99:
            v = -0.99
        if v > 5.0:
            v = 5.0

        return v

    db = get_db()
    perf = db["performance_daily"]

    # Build clean rows, sort by date so running totals are deterministic
    rows: list[dict[str, Any]] = []
    for _, r in df.iterrows():
        d = _to_iso_date(str(r.get(col_date, "")).strip())
        if not d:
            continue

        bal = _to_float(r.get(col_bal))
        if bal is None:
            continue

        dc = _to_float(r.get(col_dollar_change)) if col_dollar_change else None
        roth_ret = _clamp_ret(_to_float(r.get(col_roth_ret))) if col_roth_ret else None
        voo_close = _to_float(r.get(col_voo_close)) if col_voo_close else None
        qqq_close = _to_float(r.get(col_qqq_close)) if col_qqq_close else None

        rows.append(
            {
                "date": d,
                "balance": float(bal),
                "dollar_change": float(dc) if dc is not None else None,
                "roth_ret": roth_ret,          # decimal daily return
                "voo_close": voo_close,        # price
                "qqq_close": qqq_close,        # price
            }
        )


    rows.sort(key=lambda x: x["date"])

    written = 0

    # Running totals you asked for (simple sum of daily % points)
    roth_running_pct = 0.0
    voo_running_pct = 0.0
    qqq_running_pct = 0.0

    for row in rows:
        update_set: dict[str, Any] = {
            "date": row["date"],
            "balance": float(row["balance"]),
            "updated_at": utcnow(),
            "source_file": filename,
        }

        if row["dollar_change"] is not None:
            update_set["dollar_change"] = float(row["dollar_change"])

        # ✅ Store Roth daily return where portfolio.py expects it
        if row["roth_ret"] is not None:
            rr = float(row["roth_ret"])
            update_set["pct_change"] = rr         # <-- THIS is what equity-curve reads
            update_set["pct_change_pct"] = rr * 100.0

        # ✅ Store benchmark CLOSE prices (router will compute returns)
        if row.get("voo_close") is not None:
            update_set["voo_close"] = float(row["voo_close"])

        if row.get("qqq_close") is not None:
            update_set["qqq_close"] = float(row["qqq_close"])

        await perf.update_one(
            {"date": row["date"]},
            {"$set": update_set, "$setOnInsert": {"created_at": utcnow()}},
            upsert=True,
        )
        written += 1


    return {"rows_written": written}
