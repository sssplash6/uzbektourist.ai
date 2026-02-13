# uzbektourist.ai — AI Travel Assistant for Uzbekistan

[![Vercel](https://img.shields.io/badge/deployed-vercel-black)](https://vercel.com)
![Next.js](https://img.shields.io/badge/next.js-14-black)
![TypeScript](https://img.shields.io/badge/typescript-5-blue)
![RAG](https://img.shields.io/badge/RAG-enabled-0f766e)
![Status](https://img.shields.io/badge/status-live-success)

A minimal, **citation‑grounded** travel assistant for Uzbekistan with **Q&A** and **structured itineraries**. Built for MBZUAI admissions to demonstrate applied AI/ML system design: RAG, structured outputs, evaluation, and a KB ingestion pipeline.

**Live:** hosted on Vercel (production deployment)

---

## Why This Project
Tourists need accurate, localized guidance on transport, visas, and city planning. Generic chatbots are fast but often unreliable. This project prioritizes **grounding and transparency**:

- Retrieval‑augmented generation (RAG) over curated sources
- Citations for every grounded answer
- Structured JSON itinerary output for clean UI rendering
- Evaluation harness to track quality and regressions

---

## Key Features

- **Q&A Mode**: concise answers about transport, safety, lodging, food, and routes
- **Itinerary Mode**: structured JSON → clean UI (morning / afternoon / evening)
- **RAG + Citations**: all responses grounded in `data/sources.json`
- **KB Ingestion**: convert markdown KB into retrievable sources
- **Evaluation**: automated checks + report output
- **Feedback Loop**: optional Postgres persistence for user feedback

---

## System Design (High‑Level)

1. User query →
2. Retriever selects relevant KB chunks →
3. Model answers with citations →
4. UI renders sources + structured itineraries →
5. Eval + feedback improve quality

---

## Tech Stack

- **Next.js 14** (App Router)
- **OpenRouter** (OpenAI‑compatible API)
- **RAG** via lightweight TF‑IDF retrieval
- **Structured JSON outputs** for itinerary mode
- **Postgres (optional)** for feedback storage

---

## Knowledge Base Ingestion
If you maintain a KB as Markdown files, ingest them into `data/sources.json`:

```bash
KB_PATH="/absolute/path/to/backend/kb" npm run ingest:kb
```

This turns `.md` guides into grounded RAG sources without manual copy/paste.

---

## Evaluation
Run automated checks and generate a report:

```bash
npm run eval
```

Outputs: `eval/report.json`

---

## Deployment (Vercel)

- Import the GitHub repo in Vercel
- Add env vars:
  - `AI_BASE_URL`
  - `AI_API_KEY`
  - `AI_MODEL`
  - Optional: `AI_HTTP_REFERER`, `AI_APP_TITLE`, `POSTGRES_URL`
- Deploy

---

## Responsible AI

- No hallucinated prices or schedules
- Explicit uncertainty if sources are missing
- Citations for every grounded answer
- Evaluation to monitor regressions

---

## Project Structure

```
app/
  api/
    chat/route.ts       # LLM API route
    feedback/route.ts   # feedback endpoint
  page.tsx              # UI
  globals.css           # styling
lib/
  rag.ts                # retrieval logic
data/
  sources.json          # curated sources
scripts/
  ingest_kb.js          # KB → sources
  eval.js               # evaluation
```

---

Built for travelers in Uzbekistan with ❤ by [sant1x](https://github.com/sssplash6)
