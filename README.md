# uzbektourist.ai

Minimal, low-cost tourist assistant for Uzbekistan (English only). Built for Vercel deployment.

## Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env.local`

```bash
cp .env.example .env.local
```

Fill in `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` for any OpenAI-compatible provider.
For OpenRouter, use:

- `AI_BASE_URL=https://openrouter.ai/api/v1`
- `AI_MODEL=openai/gpt-oss-120b:free`
- Optional: `AI_HTTP_REFERER=https://uzbektourist.uz` and `AI_APP_TITLE=uzbektourist.ai`

3. Run locally

```bash
npm run dev
```

## Deploy to Vercel

- Add the same environment variables in your Vercel project settings.
- Deploy normally; no extra configuration required.

## Notes

- The app uses tight token limits to keep costs minimal.
- The assistant avoids exact prices/schedules and recommends verifying with official sources.
- Add trusted sources to `data/sources.json` to enable citations and RAG.
- Feedback is stored in Postgres if `POSTGRES_URL` is set. Without it, feedback falls back to in-memory storage.

## Knowledge Base Ingestion

If you maintain markdown files in a KB folder, ingest them into `data/sources.json`:

```bash
KB_PATH="/absolute/path/to/backend/kb" npm run ingest:kb
```

If no `KB_PATH` is provided, it defaults to `backend/kb` relative to the repo.

## Structured Itineraries

Itinerary mode expects JSON from the model and renders a structured UI (days, morning/afternoon/evening, transport notes, tips, sources). If JSON parsing fails, it falls back to markdown.

## RAG (Retrieval)

The API will automatically pull relevant snippets from `data/sources.json` and cite them as `[S1]`, `[S2]`, etc. If no sources are available, it will end with `Sources: none`.

See `data/README.md` for the file format.

## Evaluation

Create or edit `eval/questions.json`, then run:

```bash
EVAL_API_URL="http://localhost:3000/api/chat" node scripts/eval.js
```

The script checks that responses include a `Sources:` line and reports basic pass/fail stats.
