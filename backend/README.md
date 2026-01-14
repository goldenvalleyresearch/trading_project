# Backend – Trading Platform API

FastAPI backend that powers the trading platform.  
Responsible for data ingestion, normalization, storage, authentication, and API delivery to the frontend.

---

## Tech Stack

- Python 3.10+
- FastAPI
- MongoDB
- JWT authentication
- Bcrypt password hashing
- Optional external data (Polygon)

---

## Responsibilities

- Serve read-only research data to the frontend
- Accept and normalize uploaded research files
- Store normalized data in MongoDB
- Handle authentication (JWT + cookies)
- Enforce CORS for frontend access
- Keep API responses deterministic (SSR-safe for frontend)

---

## Project Structure

backend/
- app/
  - main.py            # FastAPI entry point
  - routers/           # API route definitions
  - models/            # Pydantic models
  - services/          # Business logic
  - auth/              # JWT, cookies, hashing
  - db/                # MongoDB connection + helpers
- requirements.txt or pyproject.toml
- .env

---

## Environment Variables

Create a `.env` file in the backend root.

### Example `.env`

MONGO_URI=
MONGO_DB=obvioustrades

CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

POLYGON_API_KEY=

JWT_SECRET=dev-super-secret-change-me-please-1234567890
JWT_ALG=HS256

ACCESS_TOKEN_TTL_MIN=60

REFRESH_TOKEN_TTL_DAYS=14

ACCESS_COOKIE_NAME=access_token

REFRESH_COOKIE_NAME=refresh_token

COOKIE_SECURE=false

COOKIE_SAMESITE=lax

BCRYPT_ROUNDS=12

BREVO_API_KEY=

BREVO_FROM_EMAIL=

PUBLIC_APP_URL = (site domain)

BACKEND_URL = http://localhost:8000


---

## Authentication

- JWT-based auth
- Access + refresh tokens
- Tokens stored in HTTP-only cookies
- Configurable TTLs
- Cookie settings adjustable for local vs production

---

## Research API

Core endpoints:

- GET /api/research/latest
  - Returns normalized research rows
  - Supports limit and kind filters

- GET /api/research/files
  - Lists uploaded research files

- POST /api/research/upload/fundamentals
- POST /api/research/upload/factors
  - Multipart CSV uploads
  - Auto-normalization on ingest

---

## Data Normalization

- Backend accepts flexible CSV schemas
- Normalizes:
  - Symbols
  - Numeric fields
  - Grades
  - Dates
- Frontend receives consistent, predictable data

---

## Running the Backend

Install dependencies:
pip install -r requirements.txt

or (if using poetry):
poetry install

Run the server:
uvicorn app.main:app --reload

Default:
http://localhost:8000

---

## Notes

- Backend is the single source of truth
- Designed to prevent frontend hydration mismatches
- Safe for SSR consumption
- Production-ready with env-based configuration

--- 