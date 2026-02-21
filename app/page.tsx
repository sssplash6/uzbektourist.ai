"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

type Role = "user" | "assistant";

type Source = {
  id: string;
  title: string;
  url: string;
};

type Message = {
  id: string;
  role: Role;
  content: string;
  sources?: Source[];
};

type Mode = "chat" | "itinerary";

const cities = [
  "Tashkent",
  "Samarkand",
  "Bukhara",
  "Khiva",
  "Fergana Valley"
];

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: Array.from(
    new Set([
      ...(defaultSchema.tagNames ?? []),
      "br",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "del"
    ])
  ),
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      "target",
      "rel"
    ],
    th: ["align"],
    td: ["align"]
  }
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, "sent" | "error" | "sending">>({});

  const [city, setCity] = useState(cities[0]);
  const [days, setDays] = useState(3);
  const [style, setStyle] = useState("balanced");
  const [budget, setBudget] = useState("standard");
  const [interests, setInterests] = useState("");
  const [itinerary, setItinerary] = useState("");
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [itinerarySources, setItinerarySources] = useState<Source[]>([]);

  const placeholder =
    "Ask about transport, hotels, safety, food, routes...";

  function createId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function applySourceLinks(text: string, sources?: Source[]) {
    if (!sources || sources.length === 0) return text;
    let result = text;
    sources.forEach((source, index) => {
      const token = `S${index + 1}`;
      const anchor = `<a href="${source.url}" target="_blank" rel="noreferrer">${token}</a>`;
      const regex = new RegExp(`\\[${token}\\]|\\b${token}\\b`, "g");
      result = result.replace(regex, anchor);
    });
    return result;
  }

  function normalizeSpacing(text: string) {
    const stripped = text
      .replace(/<p>\s*(?:&nbsp;|&#160;|&#32;|\u00A0|<br\s*\/?>|\s)*<\/p>/gi, "")
      .replace(/<div>\s*(?:&nbsp;|&#160;|&#32;|\u00A0|<br\s*\/?>|\s)*<\/div>/gi, "")
      .replace(/&nbsp;|&#160;|&#32;|\u00A0/g, " ")
      .replace(/(<br\s*\/?>\s*)+(?=<table)/gi, "")
      .replace(/(<br\s*\/?>\s*)+(?=\n?\|)/gi, "\n")
      .replace(/<br\s*\/?>\s*(<\/p>|<table)/gi, "$1")
      .replace(/(<\/h[1-4]>)\s*(?:<br\s*\/?>|\s)*\s*(<table)/gi, "$1$2");

    const rawLines = stripped
      .split("\n")
      .map((line) => line.replace(/\s+$/g, ""));

    const output: string[] = [];
    let prevWasTable = false;

    for (const line of rawLines) {
      const trimmed = line.trim();
      const isEmpty = /^\s*(?:<br\s*\/?>|&nbsp;|&#160;|&#32;|\u00A0|\s)*\s*$/i.test(trimmed);
      const isTableLine =
        trimmed.startsWith("|") ||
        trimmed.startsWith("<table") ||
        trimmed.startsWith("<thead") ||
        trimmed.startsWith("<tbody") ||
        trimmed.startsWith("<tr");

      if (isEmpty) {
        continue;
      }

      if (!isTableLine && prevWasTable) {
        output.push("");
      }

      if (/^Sources:/i.test(trimmed)) {
        if (output.length > 0 && output[output.length - 1] !== "") {
          output.push("");
        }
        const cleaned = trimmed.replace(/\[([^\]]+)\]/g, "$1");
        output.push(cleaned);
        prevWasTable = false;
        continue;
      }

      output.push(line);
      prevWasTable = isTableLine;
    }

    return output.join("\n").trim();
  }

  function getPreviousUserQuestion(startIndex: number, list: Message[]) {
    for (let i = startIndex - 1; i >= 0; i -= 1) {
      if (list[i].role === "user") {
        return list[i].content;
      }
    }
    return "";
  }

  async function sendFeedback(
    message: Message,
    index: number,
    rating: 1 | -1,
    questionOverride?: string
  ) {
    if (feedbackState[message.id] === "sending" || feedbackState[message.id] === "sent") {
      return;
    }

    setFeedbackState((prev) => ({ ...prev, [message.id]: "sending" }));

    try {
      const payload = {
        messageId: message.id,
        rating,
        mode,
        question: questionOverride ?? getPreviousUserQuestion(index, messages),
        answer: message.content,
        sources: message.sources ?? []
      };

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Feedback failed");
      }

      setFeedbackState((prev) => ({ ...prev, [message.id]: "sent" }));
    } catch {
      setFeedbackState((prev) => ({ ...prev, [message.id]: "error" }));
    }
  }

  async function sendChat() {
    setChatError(null);
    const trimmed = input.trim();
    if (!trimmed) return;

    const nextMessages: Message[] = [
      ...messages,
      { id: createId(), role: "user", content: trimmed }
    ];
    setMessages(nextMessages);
    setInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          messages: nextMessages
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }

      const data = await res.json();
      setMessages([
        ...nextMessages,
        {
          id: createId(),
          role: "assistant",
          content: data.text,
          sources: data.sources ?? []
        }
      ]);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unexpected error"
      );
    } finally {
      setChatLoading(false);
    }
  }

  async function generateItinerary() {
    setItineraryError(null);
    setItinerary("");
    setItineraryLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "itinerary",
          city,
          days,
          style,
          budget,
          interests
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }

      const data = await res.json();
      setItinerary(data.text);
      setItinerarySources(data.sources ?? []);
    } catch (error) {
      setItineraryError(
        error instanceof Error ? error.message : "Unexpected error"
      );
    } finally {
      setItineraryLoading(false);
    }
  }

  return (
    <main>
      <div className="container">
        <header className="header">
          <div className="brand">
            <h1>uzbektourist.ai</h1>
            <p>Minimal travel assistant for Uzbekistan</p>
          </div>
          <div className="controls">
            <div className="tabs">
              <button
                className={`tab ${mode === "chat" ? "active" : ""}`}
                onClick={() => setMode("chat")}
                type="button"
              >
                Q&A
              </button>
              <button
                className={`tab ${mode === "itinerary" ? "active" : ""}`}
                onClick={() => setMode("itinerary")}
                type="button"
              >
                Itinerary
              </button>
            </div>
          </div>
        </header>

        {mode === "chat" ? (
          <section className="card chat-window">
            <div className="messages">
              {messages.length === 0 ? (
                <p className="helper">
                  Ask about intercity transport, visas, lodging, must-see spots,
                  safety.
                </p>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`message ${message.role}`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
                      components={{
                        a: ({ ...props }) => (
                          <a {...props} target="_blank" rel="noreferrer" />
                        )
                      }}
                    >
                      {normalizeSpacing(
                        applySourceLinks(message.content, message.sources)
                      )}
                    </ReactMarkdown>
                    {message.role === "assistant" && (
                      <div className="feedback-row">
                        <span className="helper">Was this helpful?</span>
                        <div className="feedback-actions">
                          <button
                            className="chip"
                            type="button"
                            disabled={feedbackState[message.id] === "sending" || feedbackState[message.id] === "sent"}
                            onClick={() => void sendFeedback(message, index, 1)}
                          >
                            Helpful
                          </button>
                          <button
                            className="chip"
                            type="button"
                            disabled={feedbackState[message.id] === "sending" || feedbackState[message.id] === "sent"}
                            onClick={() => void sendFeedback(message, index, -1)}
                          >
                            Not helpful
                          </button>
                        </div>
                        {feedbackState[message.id] === "sent" && (
                          <span className="helper">Thanks!</span>
                        )}
                        {feedbackState[message.id] === "error" && (
                          <span className="helper">Could not save.</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {chatError && <p className="helper">{chatError}</p>}

            <div className="form-row">
              <div className="stacked-field">
                <span className="helper">Ask a question</span>
                <input
                  className="input"
                  placeholder={placeholder}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendChat();
                    }
                  }}
                />
              </div>
              <div className="stacked-field">
                <span className="helper">Action</span>
                <button
                  className="button"
                  onClick={() => void sendChat()}
                  disabled={chatLoading}
                  type="button"
                >
                  {chatLoading ? "Sending..." : "Send"}
                </button>
              </div>
            </div>

            <p className="helper">
              Tips are not official. Always confirm hours and prices.
            </p>
          </section>
        ) : (
          <section className="card">
            <div className="form-row roomy">
              <div className="stacked-field">
                <span className="helper">City</span>
                <select
                  className="select"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                >
                  {cities.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="stacked-field">
                <span className="helper">Days</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={10}
                  value={days}
                  onChange={(event) =>
                    setDays(Math.max(1, Math.min(10, Number(event.target.value))))
                  }
                />
              </div>
              <div className="stacked-field">
                <span className="helper">Pace</span>
                <select
                  className="select"
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                >
                  <option value="relaxed">
                    Relaxed
                  </option>
                  <option value="balanced">
                    Balanced
                  </option>
                  <option value="packed">
                    Packed
                  </option>
                </select>
              </div>
              <div className="stacked-field">
                <span className="helper">Budget</span>
                <select
                  className="select"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                >
                  <option value="budget">
                    Budget
                  </option>
                  <option value="standard">
                    Standard
                  </option>
                  <option value="comfort">
                    Comfort
                  </option>
                </select>
              </div>
            </div>

            <div className="stacked-field">
              <span className="helper">Interests and constraints</span>
              <textarea
                className="textarea"
                placeholder={
                  "e.g., history, architecture, halal food, no night trains"
                }
                value={interests}
                onChange={(event) => setInterests(event.target.value)}
              />
            </div>

            {itineraryError && <p className="helper">{itineraryError}</p>}

            <div className="form-row">
              <button
                className="button"
                onClick={() => void generateItinerary()}
                disabled={itineraryLoading}
                type="button"
              >
                {itineraryLoading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Generating...
                  </>
                ) : (
                  "Generate itinerary"
                )}
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setItinerary("");
                }}
                type="button"
              >
                Clear
              </button>
            </div>
            {itinerary ? (
              <div className="message assistant" style={{ marginTop: 16 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
                  components={{
                    a: ({ ...props }) => (
                      <a {...props} target="_blank" rel="noreferrer" />
                    )
                  }}
                >
                  {normalizeSpacing(applySourceLinks(itinerary, itinerarySources))}
                </ReactMarkdown>
                <div className="feedback-row">
                  <span className="helper">Was this helpful?</span>
                  <div className="feedback-actions">
                    <button
                      className="chip"
                      type="button"
                      disabled={
                        feedbackState["itinerary"] === "sending" ||
                        feedbackState["itinerary"] === "sent"
                      }
                      onClick={() =>
                        void sendFeedback(
                          {
                            id: "itinerary",
                            role: "assistant",
                            content: itinerary,
                            sources: itinerarySources
                          },
                          -1,
                          1,
                          `Itinerary request: city=${city}, days=${days}, pace=${style}, budget=${budget}, interests=${interests || "none"}`
                        )
                      }
                    >
                      Helpful
                    </button>
                    <button
                      className="chip"
                      type="button"
                      disabled={
                        feedbackState["itinerary"] === "sending" ||
                        feedbackState["itinerary"] === "sent"
                      }
                      onClick={() =>
                        void sendFeedback(
                          {
                            id: "itinerary",
                            role: "assistant",
                            content: itinerary,
                            sources: itinerarySources
                          },
                          -1,
                          -1,
                          `Itinerary request: city=${city}, days=${days}, pace=${style}, budget=${budget}, interests=${interests || "none"}`
                        )
                      }
                    >
                      Not helpful
                    </button>
                  </div>
                  {feedbackState["itinerary"] === "sent" && (
                    <span className="helper">Thanks!</span>
                  )}
                  {feedbackState["itinerary"] === "error" && (
                    <span className="helper">Could not save.</span>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        )}

        <section className="footer">
          <span>
            Built for travelers in Uzbekistan with ❤ by{" "}
            <a href="https://github.com/sssplash6" target="_blank" rel="noreferrer">
              sant1x
            </a>
          </span>
        </section>
      </div>
    </main>
  );
}
