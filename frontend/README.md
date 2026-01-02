# Frontend – Trading Platform UI

Next.js frontend for the trading platform.  
Responsible for rendering portfolio, research, performance, and transparency views using data from the backend API.

---

## Tech Stack

- Next.js (App Router)
- React
- TypeScript
- CSS Modules
- Server Components (SSR)
- Deterministic formatting for hydration safety

---

## Responsibilities

- Render read-only trading data
- Consume backend API safely (SSR + CSR)
- Avoid hydration mismatches
- Provide fast initial loads with incremental rendering
- Present research, portfolio, performance, and transparency pages

---

## Project Structure

new-frontend/
- src/
  - app/
    - portfolio/
    - research/
    - performance/
    - transparency/
  - components/
    - Header_bar/
    - FeatureCard/
    - Footer/
  - lib/
    - api.ts        # API wrapper
    - research.ts  # Research data helpers + formatters
    - site.ts      # Site constants
- public/
- next.config.js
- package.json
- .env.local

---

## Environment Variables

Create a `.env.local` file in `new-frontend/`.

### Example `.env.local`

NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000

---

## API Communication

- All API calls go through `src/lib/api.ts`
- Base URL comes from `NEXT_PUBLIC_API_BASE_URL`
- Frontend never hardcodes backend URLs
- Compatible with local, staging, and production

---

## Hydration Safety

This frontend is built to avoid common React hydration errors:

- Fixed locale formatting (`en-US`)
- No `Date.now()` or `Math.random()` during render
- Deterministic sorting
- Identical HTML between server and client
- Data slicing instead of conditional DOM removal

---

## Rendering Strategy

- Server Components for initial load
- Minimal client-side state
- Large datasets rendered in slices
- "Load more" via URL parameters (not client state)
- Mobile/desktop handled via CSS only

---

## Research Page Notes

- Supports:
  - View modes (All / Merged / Fundamentals / Factors)
  - Rated-only filter
  - Incremental row loading
- Sorting and formatting happen server-side
- Mobile cards and desktop tables render simultaneously (CSS hides unused layout)

---

## Running the Frontend

Install dependencies:
npm install

Run dev server:
npm run dev

Default:
http://localhost:3000

---

## Production Notes

- Set `NEXT_PUBLIC_API_BASE_URL` to production backend
- Enable secure cookies on backend
- Use HTTPS in production
- Frontend is fully static-compatible except API calls

---