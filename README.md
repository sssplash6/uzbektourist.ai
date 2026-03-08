# 🌍 uzbektourist.ai — Your Smart AI Travel Companion for Uzbekistan 🇺🇿

<div align="center">

![Status](https://img.shields.io/badge/status-live-success?style=for-the-badge&color=22c55e)
![Vercel](https://img.shields.io/badge/deployed-vercel-black?style=for-the-badge&logo=vercel)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![AI](https://img.shields.io/badge/AI-RAG%20Powered-0f766e?style=for-the-badge)

**An AI-powered travel assistant built specifically for Uzbekistan — delivering accurate answers, structured itineraries, and transparent sourcing.**

🚀 **Live Demo:** Deployed on Vercel (production)

</div>

---

## ✨ What is uzbektourist.ai?

**uzbektourist.ai** is a modern, minimal AI travel assistant designed to solve one of the biggest problems in tourism AI: **hallucination**.

Instead of generating generic, unreliable answers, this system is built on **Retrieval-Augmented Generation (RAG)**, ensuring that **every response is grounded in verified sources and fully cited**.

This project was built as part of an **AI systems engineering showcase for MBZUAI admissions**, demonstrating:

- End-to-end RAG pipelines
- Structured AI outputs
- Evaluation harnesses
- Knowledge base ingestion pipelines

---

## 🧠 Why This Matters

Tourists in Uzbekistan struggle to find **accurate, localized, and up-to-date information** about:

- Transport
- Visas & entry rules
- City navigation
- Safety
- Cultural etiquette

Most AI chatbots respond quickly — but **often incorrectly**.

> 🎯 Our goal: **Accuracy → Transparency → Trust.**

We prioritize **grounding, citations, and structured responses** over raw generation.

---

## 🚀 Key Features

### 🔍 Smart Q&A
Concise, factual answers about:
- Transportation
- Safety
- Accommodation
- Food
- Routes
- Local tips

### 🗺️ Structured Itinerary Generation
- Clean **JSON → UI rendering**
- Morning / Afternoon / Evening breakdown
- Location-based planning

### 📚 RAG + Citations
- All responses grounded in `data/sources.json`
- Explicit citations for transparency

### ⚙️ Knowledge Base Ingestion
- Convert Markdown travel guides into retrievable AI knowledge

### 🧪 Evaluation Harness
- Automated regression checks
- JSON evaluation reports

### 💬 Feedback Loop (Optional)
- Store user feedback in Postgres
- Improve responses iteratively

---

## 🏗️ System Architecture (High-Level)

```text
User Query
     ↓
Retriever → Selects Relevant KB Chunks
     ↓
LLM → Generates Grounded Answer + Citations
     ↓
UI → Renders Structured Output + Sources
     ↓
Evaluation + Feedback Loop
```

---

## 🛠️ Tech Stack

| Layer | Tech |
|--------|------|
| Frontend | **Next.js 14 (App Router)** |
| Language | **TypeScript** |
| AI API | **OpenRouter (OpenAI-compatible)** |
| Retrieval | **TF‑IDF based lightweight RAG** |
| Storage | **Postgres (optional)** |
| Deployment | **Vercel** |

---

## 📦 Knowledge Base Ingestion

Maintain your knowledge base as clean Markdown files and convert them into retrievable AI sources:

```bash
KB_PATH="/absolute/path/to/backend/kb" npm run ingest:kb
```

This builds `data/sources.json`, enabling:

- Grounded generation
- Citation linking
- Fast retrieval

---

## 🧪 Evaluation & Testing

Run automated evaluation checks:

```bash
npm run eval
```

📄 Outputs:

```
eval/report.json
```

Used to:

- Detect regressions
- Track answer quality
- Validate citations

---

## 🚢 Deployment Guide (Vercel)

1. Import GitHub repo into Vercel
2. Configure environment variables:

```env
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
AI_HTTP_REFERER=  # optional
AI_APP_TITLE=    # optional
POSTGRES_URL=    # optional
```

3. Deploy 🚀

---

## 🔐 Responsible AI Principles

- ❌ No hallucinated prices, schedules, or routes
- ⚠️ Explicit uncertainty when sources are missing
- 📌 Mandatory citations for grounded answers
- 📊 Continuous evaluation & regression monitoring

---

## 🗂️ Project Structure

```bash
app/
  api/
    chat/route.ts       # LLM API endpoint
    feedback/route.ts   # feedback ingestion
  page.tsx              # UI
  globals.css           # styling

lib/
  rag.ts                # retrieval logic

data/
  sources.json          # curated knowledge sources

scripts/
  ingest_kb.js          # KB → RAG ingestion
  eval.js               # evaluation harness
```

---

## 🌟 Built With Passion

Built for travelers in Uzbekistan with ❤️  
By **[sant1x](https://github.com/sssplash6)**

---

## 🤝 Contributions

PRs, ideas, and improvements are welcome. Feel free to open issues or submit enhancements.

---

## ⭐ If You Like This Project

Consider giving it a **star ⭐** — it helps others discover it and motivates further development!

