import fs from "fs";
import path from "path";

const apiUrl = process.env.EVAL_API_URL || "http://localhost:3000/api/chat";
const filePath = path.join(process.cwd(), "eval", "questions.json");
const raw = fs.readFileSync(filePath, "utf-8");
const tests = JSON.parse(raw);

const results = [];

for (const test of tests) {
  const body =
    test.mode === "chat"
      ? {
          mode: "chat",
          messages: [{ role: "user", content: test.input }]
        }
      : {
          mode: "itinerary",
          city: test.city,
          days: test.days,
          style: test.style,
          budget: test.budget,
          interests: test.interests
        };

  const start = Date.now();
  let responseText = "";
  let responseSources = [];
  let responseItinerary = null;
  let error = null;

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `HTTP ${res.status}`);
    }

    const data = await res.json();
    responseText = data.text || "";
    responseSources = data.sources || [];
    responseItinerary = data.itinerary || null;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - start;
  const hasSourcesLine =
    /\bSources:\s*/i.test(responseText) ||
    (responseItinerary && Array.isArray(responseItinerary.sources));
  const hasDayStructure =
    /\bDay\s+1\b/i.test(responseText) ||
    (responseItinerary && Array.isArray(responseItinerary.days) && responseItinerary.days.length > 0);
  const hasStructuredItinerary =
    responseItinerary &&
    typeof responseItinerary.title === "string" &&
    Array.isArray(responseItinerary.days);

  const checks = {
    sources: hasSourcesLine,
    dayStructure: test.expectDayStructure ? hasDayStructure : true,
    structured: test.mode === "itinerary" ? Boolean(hasStructuredItinerary) : true,
    sourcesReturned: responseSources.length >= 0
  };

  results.push({
    id: test.id,
    mode: test.mode,
    durationMs,
    ok: !error && Object.values(checks).every(Boolean),
    error,
    checks,
    sample: responseText.slice(0, 240),
    sourcesCount: responseSources.length
  });
}

const passed = results.filter((result) => result.ok).length;
const total = results.length;

console.log(`Eval results: ${passed}/${total} passed`);
for (const result of results) {
  console.log(`- ${result.id} (${result.mode}): ${result.ok ? "ok" : "fail"}`);
  if (result.error) {
    console.log(`  error: ${result.error}`);
  } else {
    console.log(`  sources: ${result.checks.sources}`);
    if (result.mode === "itinerary") {
      console.log(`  dayStructure: ${result.checks.dayStructure}`);
      console.log(`  structured: ${result.checks.structured}`);
    }
    console.log(`  sourcesCount: ${result.sourcesCount}`);
    console.log(`  sample: ${result.sample.replace(/\n/g, " ")}`);
  }
}

const report = {
  summary: {
    passed,
    total,
    timestamp: new Date().toISOString()
  },
  results
};

fs.writeFileSync(
  path.join(process.cwd(), "eval", "report.json"),
  JSON.stringify(report, null, 2)
);
