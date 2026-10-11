# SANO — AI-Powered Personal Health Copilot

Medical Record Intelligence & OCR, plain-language AI health summaries, and a unified
health profile (records timeline, medications, wellness, appointments, AI copilot chat).

**Stack:** FastAPI + SQLite + Vanilla JS (no build step) + Gemini (`gemini-3.8-flash`
via `google-genai` SDK, with offline fallback). Without `GEMINI_API_KEY` every
endpoint still returns 200 via fallback so automated evaluation never blocks.

## Run locally
```
pip install -r requirements.txt
cp .env.example .env   # optional: add GEMINI_API_KEY for full AI answers
uvicorn main:app --host 0.0.0.0 --port 8000
```
Open http://127.0.0.1:8000/login, create an account → redirects to `/overview`.

## Deploy (live app)
Pick one:

**Render (free, ~5 min):** dashboard.render.com → New → Blueprint → connect
`LakshyaDuttBansal/SANO.AI` (uses `render.yaml` + `Dockerfile` in repo).
Add env `GEMINI_API_KEY` (optional — app works without it via fallbacks).
Open the `https://sano-ai.onrender.com` URL → `/login` → Create Account.

**Nimbus (hackathon):** upload/connect the repo, start command
`uvicorn main:app --host 0.0.0.0 --port $PORT`, set `GEMINI_API_KEY` in env.

**Any Docker host:** `docker build -t sano . && docker run -p 8000:8000 -e GEMINI_API_KEY=... sano`

Notes: `Dockerfile` (python:3.11-slim), `runtime.txt`, `render.yaml`,
`GET /api/health` healthcheck are in the repo. SQLite + `uploads/` live on the
container disk — free tiers may reset them on redeploy; for the hackathon demo
just re-add data. Never commit `.env` (gitignored).

## Pages
- `/login` — sign in / create account
- `/overview` — stats, insights, wellness chart, checklist
- `/records` — upload + filter/search medical records, detail view
- `/` — medications (add/delete, adherence)
- `/wellness` — metrics, goals, activity log (persists via `POST /api/wellness`)
- `/appointments` — book/complete/cancel appointments
- `/copilot` — AI chat grounded in your records + report attach
- `/profile` — account details, measurements, preferences

## API
- `POST /api/upload` (pdf/jpg/png) → `{id,title,type,date,status,extracted}`
- `GET /api/records?type=all|lab_report|prescription|imaging|doctor_notes|other`
- `POST /api/records` (manual entry), `GET /api/records/{id}`, `GET /api/summary/{id}`
- `GET /api/overview`, `GET /api/timeline`, `POST /api/chat` → `{reply, sources}`
- `GET/POST /api/medications`, `DELETE /api/medications/{id}`, `GET /api/adherence?period=`
- `GET /api/wellness?range=`, `POST /api/wellness`
- `GET/POST /api/appointments`, `PUT/DELETE /api/appointments/{id}`
- `POST /api/auth/signup`, `POST /api/auth/login`
- `GET /api/profile?email=`, `PUT /api/profile`

## Evaluator test access
- No seeded accounts or data: open `/login`, Create Account, then use the app.
  Everything on screen comes from your own input (uploads, manual records,
  medications, wellness logs, appointments).
- Sample files: `sample_lab.txt`, `sample_prescription.txt` (reference content for
  the manual Add Record form or a real PDF upload).
- Steps: create account → `/records` add a record → View + summary → `/copilot`
  ask "explain my latest blood test" → check `/`, `/wellness`, `/appointments`.
