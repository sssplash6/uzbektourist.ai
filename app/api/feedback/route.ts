import { sql } from "@vercel/postgres";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

type FeedbackBody = {
  messageId?: string;
  rating?: 1 | -1;
  mode?: string;
  question?: string;
  answer?: string;
  sources?: Array<{ id: string; title: string; url: string }>;
};

const memoryStore: FeedbackBody[] = [];

export async function POST(req: Request) {
  const body = (await req.json()) as FeedbackBody;

  if (!body || (body.rating !== 1 && body.rating !== -1)) {
    return NextResponse.json({ error: "Invalid feedback." }, { status: 400 });
  }

  const feedback = {
    id: randomUUID(),
    messageId: body.messageId ?? null,
    rating: body.rating,
    mode: body.mode ?? null,
    question: body.question ?? null,
    answer: body.answer ?? null,
    sources: body.sources ?? [],
    userAgent: req.headers.get("user-agent") ?? null
  };

  if (!process.env.POSTGRES_URL) {
    memoryStore.push(feedback);
    return NextResponse.json({ ok: true, storage: "memory" });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS feedback (
        id uuid primary key,
        created_at timestamptz default now(),
        message_id text,
        rating int not null,
        mode text,
        question text,
        answer text,
        sources jsonb,
        user_agent text
      );
    `;

    await sql`
      INSERT INTO feedback (id, message_id, rating, mode, question, answer, sources, user_agent)
      VALUES (
        ${feedback.id},
        ${feedback.messageId},
        ${feedback.rating},
        ${feedback.mode},
        ${feedback.question},
        ${feedback.answer},
        ${JSON.stringify(feedback.sources)},
        ${feedback.userAgent}
      );
    `;

    return NextResponse.json({ ok: true, storage: "postgres" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to store feedback." },
      { status: 500 }
    );
  }
}
