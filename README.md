# Trading Platform

Full-stack trading research platform with a FastAPI backend and a Next.js frontend.

---

## Structure

backend/
- FastAPI app
- Handles data ingestion, normalization, and API responses

new-frontend/
- Next.js (App Router)
- UI for research, portfolio, performance, and transparency

---

## Backend

- Built with FastAPI
- Exposes read-only research APIs
- Normalizes uploaded research data (fundamentals, factors, merged)
- Ensures consistent numeric and string formatting

Key endpoints:
- GET /api/research/latest
- GET /api/research/files
- POST /api/research/upload/fundamentals
- POST /api/research/upload/factors

---

## Frontend

- Built with Next.js
- Server-rendered pages (SSR-safe)
- No client-only randomness
- Deterministic formatting to avoid hydration errors

Main pages:
- /research
- /portfolio
- /performance
- /transparency

---

## Data Flow

Upload data → Backend normalization → API → Frontend render

---

## Running

Backend:
cd backend
uvicorn app.main:app --reload

Frontend:
cd new-frontend
npm install
npm run dev

---

## Notes

- Designed to avoid hydration mismatches
- Renders limited rows first, with “load more” behavior
- Backend is the source of truth