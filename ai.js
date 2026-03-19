const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY });

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
- Normalize each tag: lowercase, trim whitespace

Return ONLY valid JSON, no markdown, no explanation:
{
  "link": string or null,
  "handle": string or null,
  "name": string or null,
  "mediums": string[],
  "styles": string[]
}`;

  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    return JSON.parse(res.content[0].text);
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
    link: a.link,
    mediums: a.mediums,
    styles: a.styles,
  }));

  const prompt = `You are helping a creative director find the right artist/designer.

Query: "${query}"

Artist list:
${JSON.stringify(list, null, 2)}

Instructions:
- Match query against name, handle, mediums, styles
- Support fuzzy matching: "maximal" matches "maximalism", "tối" matches "dark", "3D" matches any artist with 3D in mediums or styles
- Support Vietnamese and English
- Score each match from 0-100
- Return only artists with score >= 30, sorted by score descending
- Maximum 5 results

Return ONLY valid JSON array, no markdown:
[
  {
    "id": "...",
    "score": 85
  }
]`;

  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const scored = JSON.parse(res.content[0].text);
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
