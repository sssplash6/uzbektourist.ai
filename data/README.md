# Sources for RAG

Add trusted sources here to enable citations.

## Format

`data/sources.json` must be a JSON array of objects:

```json
[
  {
    "id": "railways-uz",
    "title": "Uzbekistan Railways - Passenger Information",
    "url": "https://railway.uz/...",
    "content": "Paste cleaned text here. Keep it factual and concise."
  }
]
```

## Tips

- Use official or reputable sources.
- Keep each `content` block to 3-8 paragraphs.
- Update the `id` when you change sources so caches invalidate.
