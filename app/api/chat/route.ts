import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { retrieve } from "../../../lib/rag";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatBody = {
  mode: "chat" | "itinerary";
  messages?: Message[];
  city?: string;
  days?: number;
  style?: string;
  budget?: string;
  interests?: string;
};

const MAX_TOKENS = {
  chat: 600,
  itinerary: 1200
};

const MAX_HISTORY = 10;
const CACHE_TTL_MS = 1000 * 60 * 10;
const CACHE_VERSION = 2;
const responseCache = new Map<
  string,
  { expires: number; text: string; sources?: Array<{ id: string; title: string; url: string }> }
>();

function baseSystemPrompt() {
  return [
    "You are uzbektourist.ai, a minimal travel assistant for Uzbekistan.",
    "Focus: Tashkent, Samarkand, Bukhara, Khiva, Fergana Valley.",
    "Be concise and practical. If unsure, say so and suggest checking official sources.",
    "You may use markdown for emphasis, lists, and links. Use tables only if they are short.",
    "Do not invent prices or schedules. If needed, give rough ranges and label them as estimates.",
    "Always respond in English.",
    "End every answer with: \"Sources: ...\" using [S1], [S2] if sources were used, or \"Sources: none\" if not."
  ].join(" ");
}

function itineraryPrompt(body: ChatBody) {
  const city = body.city ?? "";
  const days = body.days ?? 3;
  const style = body.style ?? "balanced";
  const budget = body.budget ?? "standard";
  const interests = body.interests?.trim() || "(none specified)";

  return [
    `Create a ${days}-day itinerary for ${city}.`,
    `Pace: ${style}. Budget: ${budget}.`,
    `Interests/constraints: ${interests}.`,
    "Do NOT output JSON. If you are about to output JSON, convert it to the markdown table format below.",
    "Write in clean markdown with a short title.",
    "Then include a single markdown table with columns: Day | Morning | Afternoon | Evening.",
    "Each cell should have 2-4 concise bullet points.",
    "After the table, add a Transport notes section (bullets) and a Practical tips section (table with Tip | Details).",
    "Do not invent exact prices or hours. If needed, give rough ranges and label as estimates.",
    "End with a Sources line like: Sources: [S1] [S2] or Sources: none."
  ].join(" ");
}

function buildUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

function buildCacheKey(body: ChatBody, sourceIds: string[]) {
  const payload = {
    mode: body.mode,
    messages: body.messages,
    city: body.city,
    days: body.days,
    style: body.style,
    budget: body.budget,
    interests: body.interests,
    sources: sourceIds,
    cacheVersion: CACHE_VERSION
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function formatSources(chunks: ReturnType<typeof retrieve>) {
  if (chunks.length === 0) {
    return "";
  }

  const blocks = chunks.map((chunk, index) => {
    return `[S${index + 1}] ${chunk.title} (${chunk.url})\n${chunk.content}`;
  });

  return [
    "Context sources:",
    blocks.join("\n\n"),
    "Use [S#] citations tied to the sources above."
  ].join("\n\n");
}

function formatInternalNotes(chunks: ReturnType<typeof retrieve>) {
  if (chunks.length === 0) return "";
  const blocks = chunks.map((chunk, index) => {
    return `Note ${index + 1}:\n${chunk.content}`;
  });
  return [
    "Background notes (internal, do not cite):",
    blocks.join("\n\n")
  ].join("\n\n");
}

type ItineraryDay = {
  day: number;
  theme?: string;
  morning: string[];
  afternoon: string[];
  evening: string[];
};

type Itinerary = {
  title: string;
  days: ItineraryDay[];
  transportNotes: string[];
  tips: Array<{ label: string; details: string[] }>;
  sources: string[];
};

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const braceMatch = candidate.match(/\{[\s\S]*\}/);
  if (!braceMatch) return null;
  const raw = braceMatch[0];
  try {
    return JSON.parse(raw);
  } catch {
    const repaired = raw
      .replace(/[“”]/g, "\"")
      .replace(/[’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

function coerceStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
  }
  return [String(value)].filter((item) => item.trim().length > 0);
}

function normalizeItinerary(raw: unknown, fallbackSources: string[]): Itinerary | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const daysRaw = Array.isArray(obj.days) ? obj.days : [];

  const days: ItineraryDay[] = daysRaw.map((dayItem, index) => {
    const dayObj = (dayItem ?? {}) as Record<string, unknown>;
    const dayNumber = Number(dayObj.day ?? index + 1);
    return {
      day: Number.isFinite(dayNumber) ? dayNumber : index + 1,
      theme: dayObj.theme ? String(dayObj.theme) : undefined,
      morning: coerceStringArray(dayObj.morning),
      afternoon: coerceStringArray(dayObj.afternoon),
      evening: coerceStringArray(dayObj.evening)
    };
  });

  if (days.length === 0) return null;

  const title = obj.title ? String(obj.title) : "Itinerary";
  const transportNotes = coerceStringArray(obj.transportNotes);
  const tipsRaw = Array.isArray(obj.tips) ? obj.tips : [];
  const tips = tipsRaw.map((tip) => {
    const tipObj = (tip ?? {}) as Record<string, unknown>;
    return {
      label: tipObj.label ? String(tipObj.label) : "Tip",
      details: coerceStringArray(tipObj.details)
    };
  });
  const sources = coerceStringArray(obj.sources);
  const normalizedSources = sources.length > 0 ? sources : fallbackSources;

  return {
    title,
    days,
    transportNotes,
    tips,
    sources: normalizedSources
  };
}

function jsonToMarkdown(raw: unknown, fallbackSources: string[]) {
  const itinerary = normalizeItinerary(raw, fallbackSources);
  if (!itinerary) return null;

  const header = `### ${itinerary.title}`;
  const tableHeader = "| Day | Morning | Afternoon | Evening |\n| --- | --- | --- | --- |";
  const rows = itinerary.days.map((day) => {
    const dayLabel = `Day ${day.day}${day.theme ? ` — ${day.theme}` : ""}`;
    const formatCell = (items: string[]) =>
      items.length === 0 ? "—" : items.map((item) => `• ${item}`).join("<br>");
    return `| ${dayLabel} | ${formatCell(day.morning)} | ${formatCell(day.afternoon)} | ${formatCell(day.evening)} |`;
  });

  const sections: string[] = [];
  if (itinerary.transportNotes.length > 0) {
    sections.push(
      [
        "**Transport notes**",
        ...itinerary.transportNotes.map((note) => `- ${note}`)
      ].join("\n")
    );
  }

  if (itinerary.tips.length > 0) {
    const tipHeader = "| Tip | Details |\n| --- | --- |";
    const tipRows = itinerary.tips.map((tip) => {
      const detail = tip.details.length > 0
        ? tip.details.map((item) => `• ${item}`).join("<br>")
        : "—";
      return `| ${tip.label} | ${detail} |`;
    });
    sections.push(["**Practical tips**", tipHeader, ...tipRows].join("\n"));
  }

  const sources = itinerary.sources.length > 0
    ? itinerary.sources
    : fallbackSources;

  const sourcesLine = sources.includes("none")
    ? "Sources: none"
    : `Sources: ${sources.map((source) => `[${source}]`).join(" ")}`;

  return [header, "", tableHeader, ...rows, "", ...sections, "", sourcesLine]
    .filter((part) => part !== "")
    .join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as ChatBody;

  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const httpReferer = process.env.AI_HTTP_REFERER;
  const appTitle = process.env.AI_APP_TITLE;

  if (!baseUrl || !apiKey || !model) {
    return NextResponse.json(
      {
        error:
          "Missing AI_BASE_URL, AI_API_KEY, or AI_MODEL environment variables."
      },
      { status: 500 }
    );
  }

  if (!body?.mode) {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }

  if (body.mode === "chat" && (!body.messages || body.messages.length === 0)) {
    return NextResponse.json(
      { error: "Chat messages are required." },
      { status: 400 }
    );
  }

  const query =
    body.mode === "chat"
      ? body.messages?.[body.messages.length - 1]?.content ?? ""
      : `${body.city ?? ""} ${body.interests ?? ""} itinerary`;

  const webSources = retrieve(query, 4, { includeKb: false });
  const kbSources = retrieve(query, 3, { includeWeb: false });
  const sourceTokens = webSources.length > 0
    ? webSources.map((_, index) => `S${index + 1}`)
    : ["none"];
  const cacheKey = buildCacheKey(
    body,
    [...webSources, ...kbSources].map((item) => item.id)
  );
  const cached = responseCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({
      text: cached.text,
      sources: cached.sources
    });
  }

  const messages: Message[] = [
    { role: "system", content: baseSystemPrompt() }
  ];

  const sourcesMessage = formatSources(webSources);
  if (sourcesMessage) {
    messages.push({ role: "system", content: sourcesMessage });
  }
  const notesMessage = formatInternalNotes(kbSources);
  if (notesMessage) {
    messages.push({ role: "system", content: notesMessage });
  }

  if (body.mode === "chat") {
    const safeHistory = (body.messages ?? [])
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-MAX_HISTORY);

    messages.push(...safeHistory);
  } else {
    messages.push({
      role: "user",
      content: itineraryPrompt(body)
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };

  if (httpReferer) {
    headers["HTTP-Referer"] = httpReferer;
  }

  if (appTitle) {
    headers["X-Title"] = appTitle;
  }

  const response = await fetch(buildUrl(baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: body.mode === "chat" ? 0.4 : 0.6,
      max_tokens: body.mode === "chat" ? MAX_TOKENS.chat : MAX_TOKENS.itinerary
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: error || "Upstream model error" },
      { status: 502 }
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    return NextResponse.json(
      { error: "Empty response from model." },
      { status: 502 }
    );
  }

  let finalText = text;

  if (body.mode === "itinerary") {
    const parsed = extractJson(finalText);
    const converted = parsed ? jsonToMarkdown(parsed, sourceTokens) : null;
    if (converted) {
      finalText = converted;
    }
  }

  if (!/\bSources:\s*/i.test(finalText)) {
    const fallbackSources =
      webSources.length > 0
        ? webSources.map((_, index) => `[S${index + 1}]`).join(" ")
        : "none";
    finalText = `${finalText}\n\nSources: ${fallbackSources}`;
  }

  const sources = webSources.map((item, index) => ({
    id: `S${index + 1}`,
    title: item.title,
    url: item.url
  }));

  responseCache.set(cacheKey, {
    text: finalText,
    expires: Date.now() + CACHE_TTL_MS,
    sources
  });

  return NextResponse.json({ text: finalText, sources });
}
