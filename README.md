# SkillNova

**Smart Education — AI-Based Skill & Placement Learning Platform**

- Smart India Hackathon 2026 · Problem Statement **SIH26134**
- Team **TIMSCDR07** · TIMSCDR, MCA Batch E
- Tagline: *Empowering Students with Personalized AI-Driven Placement Preparation.*

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Backend  | Node.js + Express.js |
| AI/Python| Python (PDF extraction), Google Gemini API |
| Database | MySQL 8 |

## Project structure

```
SkillNova-main/
  frontend/          HTML, CSS, JS pages (served by Express)
  backend/           Node.js + Express server (routes, controllers, ...)
  python_service/    Python resume processing (Phase 5)
  database/          schema.sql and seed.sql (Phase 2)
  tests/             tests (later phases)
  .env.example       environment variable template
```

## How to run (full setup)

### 1. Install dependencies

```
npm install
pip install -r python_service/requirements.txt
```

### 2. Configure environment

Edit `.env` (copy from `.env.example` if missing) and set:

- `DB_PASSWORD` — your MySQL root password (**required** for real data;
  without it the app runs in clearly-labelled sample/demo mode)
- `SESSION_SECRET` — any long random string
- `GEMINI_API_KEY` — optional; get one at https://aistudio.google.com/.
  Without it, roadmaps and feedback use the clearly-labelled rule-based
  fallback instead of AI.

### 3. Create the database (one time)

Make sure the MySQL80 Windows service is running, then:

```
mysql -u root -p < database/schema.sql
mysql -u root -p skillnova < database/seed.sql
```

### 4. Start the server

```
npm start
```

Open **http://localhost:3000** (always this port — the Node server serves
both the pages and the APIs; a separate static server like Live Server on
port 8000 cannot reach the APIs).

### 5. Run tests

```
npm test
```

## Pages

| Page | URL |
|------|-----|
| Home | `/index.html` |
| Login / Register | `/login.html`, `/register.html` |
| Dashboard | `/dashboard.html` |
| My Roadmap | `/roadmap.html` |
| Resume Analyzer | `/resume.html` |
| Mock Interview | `/interview.html` |
| My Progress | `/progress.html` |
| Profile | `/profile.html` |

## Documented calculations (not random)

- **Readiness score** = `round(0.4*avgSkillLevel + 0.3*resumeScore + 0.3*interviewScore)`
  (`backend/services/metricsService.js`)
- **Streak** = consecutive calendar days with at least one activity in `activity_log`
- **Resume score (0–100)** = sections (max 30) + contact email (10) + portfolio links (10)
  + role-skill match (max 30, proportional) + measurable achievements (10) + length (10)
  (`backend/services/resumeService.js`). *Indicative only — not an ATS guarantee.*
- **Interview answer fallback (0–100)** = length/completeness (max 40) + key-concept
  coverage (max 50) + structure bonus (10); final score = average of answers
  (`backend/services/interviewService.js`)

## Node.js ↔ Python interface

`backend/services/resumeService.js` runs
`python python_service/extract_resume.py <pdf-path>` as a subprocess.
Python prints one JSON object to stdout:
`{"ok":true,"text":...,"pages":...,"emails":[...],"links":[...],"sections":[...]}`
or `{"ok":false,"error":"reason"}`. Scoring happens in Node.

## AI integration

`backend/services/aiService.js` calls the Google Gemini REST API using
`GEMINI_API_KEY` from `.env` (never exposed to the browser). Every result is
labelled `source: "ai"` or `source: "fallback"` in the database and the UI,
so fallback output is never presented as real AI output.

## Security

- bcrypt password hashing (10 rounds), no plain-text passwords
- express-session with httpOnly + SameSite=Lax cookie (8h expiry)
- All SQL uses parameterized queries (`pool.execute` with `?`)
- Every private query filters by the session user id — students can only
  access their own roadmap, resumes, interviews, profile and progress
- Resume uploads: PDF-only, 5 MB max, random filenames, stored in
  `backend/uploads/` (outside the public frontend folder), never executed

## Status

- [x] Phase 1 — structure, public pages, branding
- [x] Phase 2 — MySQL schema + real register/login/logout (bcrypt + sessions)
- [x] Phase 3 — profile + dynamic dashboard
- [x] Phase 4 — AI/fallback skill roadmap with saved progress
- [x] Phase 5 — Python PDF extraction + resume analyzer with history
- [x] Phase 6 — mock interview bot with question bank + feedback
- [x] Phase 7 — dashboard calculations from real records
- [x] Phase 8 — unit tests (`npm test`), empty states, error handling

> **Demo mode:** until `DB_PASSWORD` is set, `/api/dashboard` returns sample
> data labelled `source:"sample"` with a visible banner, and login/register
> return a clear 503 message explaining the required setup.
