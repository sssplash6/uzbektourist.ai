import fs from "fs";
import path from "path";

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { frontmatter: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: {}, body: raw };
  const fmBlock = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const frontmatter = {};
  for (const line of fmBlock.split("\n")) {
    const [key, ...rest] = line.split(":");
    if (!key || rest.length === 0) continue;
    frontmatter[key.trim()] = rest.join(":").trim().replace(/^"|"$/g, "");
  }
  return { frontmatter, body };
}

function extractTitle(body) {
  const match = body.match(/^#\s+(.+)$/m);
  if (!match) return { title: null, body };
  const title = match[1].trim();
  const cleaned = body.replace(match[0], "").trim();
  return { title, body: cleaned };
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

const kbPath =
  process.argv[2] ||
  process.env.KB_PATH ||
  path.join(process.cwd(), "backend", "kb");

if (!fs.existsSync(kbPath)) {
  console.error(`KB path not found: ${kbPath}`);
  process.exit(1);
}

const files = walk(kbPath);
if (files.length === 0) {
  console.error("No .md files found in KB path.");
  process.exit(1);
}

const sourcesPath = path.join(process.cwd(), "data", "sources.json");
const existing = fs.existsSync(sourcesPath)
  ? JSON.parse(fs.readFileSync(sourcesPath, "utf-8"))
  : [];

const kbSources = files.map((filePath) => {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const { title: h1Title, body: cleanedBody } = extractTitle(body);
  const title = frontmatter.title || h1Title || path.basename(filePath, ".md");
  const slug = slugify(path.relative(kbPath, filePath));
  const url = frontmatter.url || frontmatter.source || `https://uzbektourist.uz/kb/${slug}`;

  return {
    id: `kb-${slug}`,
    title,
    url,
    content: cleanedBody.trim(),
    tags: frontmatter.tags ? frontmatter.tags.split(",").map((t) => t.trim()) : undefined
  };
});

const preserved = existing.filter((item) => !String(item.id || "").startsWith("kb-"));
const merged = [...preserved, ...kbSources];

fs.writeFileSync(sourcesPath, JSON.stringify(merged, null, 2));

console.log(`Ingested ${kbSources.length} KB files into data/sources.json`);
