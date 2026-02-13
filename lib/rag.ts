import fs from "fs";
import path from "path";

export type SourceRecord = {
  id: string;
  title: string;
  url: string;
  content: string;
  tags?: string[];
};

export type RetrievedChunk = {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  content: string;
  score: number;
};

type Chunk = {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  content: string;
  tfidf: Map<string, number>;
  norm: number;
};

type Index = {
  chunks: Chunk[];
  idf: Map<string, number>;
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "he",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
  "you",
  "your"
]);

let cachedIndex: Index | null = null;

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function chunkContent(source: SourceRecord) {
  const paragraphs = source.content
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0 && source.content.trim()) {
    return [source.content.trim()];
  }

  return paragraphs;
}

function computeIdf(chunks: { tokens: string[] }[]) {
  const docCount = chunks.length || 1;
  const df = new Map<string, number>();

  for (const chunk of chunks) {
    const uniqueTokens = new Set(chunk.tokens);
    for (const token of uniqueTokens) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [token, count] of df.entries()) {
    idf.set(token, Math.log((docCount + 1) / (count + 1)) + 1);
  }

  return idf;
}

function computeTfidf(tokens: string[], idf: Map<string, number>) {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }

  const total = tokens.length || 1;
  const vector = new Map<string, number>();
  let norm = 0;

  for (const [token, count] of tf.entries()) {
    const weight = (count / total) * (idf.get(token) ?? 1);
    vector.set(token, weight);
    norm += weight * weight;
  }

  return { vector, norm: Math.sqrt(norm) };
}

function loadSources(): SourceRecord[] {
  const filePath = path.join(process.cwd(), "data", "sources.json");
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as SourceRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildIndex(): Index {
  const sources = loadSources();
  const rawChunks: Array<{
    id: string;
    sourceId: string;
    title: string;
    url: string;
    content: string;
    tokens: string[];
  }> = [];

  for (const source of sources) {
    const parts = chunkContent(source);
    parts.forEach((part, index) => {
      rawChunks.push({
        id: `${source.id}-${index + 1}`,
        sourceId: source.id,
        title: source.title,
        url: source.url,
        content: part,
        tokens: tokenize(part)
      });
    });
  }

  const idf = computeIdf(rawChunks);

  const chunks: Chunk[] = rawChunks.map((chunk) => {
    const { vector, norm } = computeTfidf(chunk.tokens, idf);
    return {
      id: chunk.id,
      sourceId: chunk.sourceId,
      title: chunk.title,
      url: chunk.url,
      content: chunk.content,
      tfidf: vector,
      norm
    };
  });

  return { chunks, idf };
}

function getIndex() {
  if (!cachedIndex) {
    cachedIndex = buildIndex();
  }

  return cachedIndex;
}

function cosineSimilarity(
  queryVector: Map<string, number>,
  queryNorm: number,
  chunk: Chunk
) {
  if (queryNorm === 0 || chunk.norm === 0) return 0;

  let dot = 0;
  for (const [token, weight] of queryVector.entries()) {
    const chunkWeight = chunk.tfidf.get(token);
    if (chunkWeight) {
      dot += weight * chunkWeight;
    }
  }

  return dot / (queryNorm * chunk.norm);
}

export function retrieve(query: string, limit = 4): RetrievedChunk[] {
  const index = getIndex();
  if (index.chunks.length === 0) return [];

  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const { vector, norm } = computeTfidf(tokens, index.idf);

  const scored = index.chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(vector, norm, chunk)
    }))
    .filter((item) => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((item) => ({
    id: item.chunk.id,
    sourceId: item.chunk.sourceId,
    title: item.chunk.title,
    url: item.chunk.url,
    content: item.chunk.content,
    score: item.score
  }));
}

export function refreshIndex() {
  cachedIndex = buildIndex();
}
