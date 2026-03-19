const Groq = require("groq-sdk");

const client = new Groq({ apiKey: process.env.GROQ_KEY });
const MODEL = "llama-3.3-70b-versatile";

async function chat(prompt) {
  const res = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0].message.content.trim();
}

// ── Parse raw input → { name, handle, link, mediums, styles } ─────────────

async function parseArtistInput(text) {
  const prompt = `Parse this artist input and extract structured data.

Input: "${text}"

Rules:
- link: any URL or instagram.com/... or behance.net/... found
- handle: @username or username from link (without @)
- name: value after "n:" if present, otherwise null
- mediums: array of values after "m:" split by comma
- styles: array of values after "s:" split by comma
- remind: full text after "r:" if present, otherwise null
- Normalize tags: lowercase, trim whitespace. Do NOT lowercase remind.

Return ONLY valid JSON, no markdown, no explanation:
{
  "link": string or null,
  "handle": string or null,
  "name": string or null,
  "mediums": string[],
  "styles": string[],
  "remind": string or null
}`;

  try {
    const text = await chat(prompt);
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ── Fuzzy + semantic search ────────────────────────────────────────────────

async function searchArtists(query, artists) {
  if (!artists.length) return [];

  const list = artists.map((a) => ({
    id: a.id,
    name: a.name,
    handle: a.handle,
    mediums: a.mediums,
    styles: a.styles,
    remind: a.remind || "",
  }));

  const prompt = `You are helping a creative director find the right artist/designer.

Query: "${query}"

Artist list:
${JSON.stringify(list, null, 2)}

Instructions:
- Match query against name, handle, mediums, styles, and remind (free-text notes)
- Support fuzzy matching: "maximal" matches "maximalism", "tối" matches "dark", "3D" matches any artist with 3D in mediums or styles
- Support Vietnamese and English
- Score each match from 0-100
- Return only artists with score >= 30, sorted by score descending
- Maximum 5 results

Return ONLY valid JSON array, no markdown, no explanation:
[{"id": "...", "score": 85}]`;

  try {
    const text = await chat(prompt);
    const clean = text.replace(/```json|```/g, "").trim();
    const scored = JSON.parse(clean);
    return scored
      .map(({ id, score }) => ({
        artist: artists.find((a) => a.id === id),
        score,
      }))
      .filter((r) => r.artist);
  } catch {
    return [];
  }
}

module.exports = { parseArtistInput, searchArtists };
