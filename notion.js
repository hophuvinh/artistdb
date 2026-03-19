const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_KEY });
const DB_ID = process.env.NOTION_DB_ID;

function toMultiSelect(arr = []) {
  return arr.map((name) => ({ name: name.trim() }));
}
function fromMultiSelect(prop) {
  return prop?.multi_select?.map((t) => t.name) ?? [];
}
function fromTitle(prop) {
  return prop?.title?.[0]?.plain_text ?? "";
}
function fromRichText(prop) {
  return prop?.rich_text?.[0]?.plain_text ?? "";
}

function pageToArtist(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: fromTitle(p["Name"]),
    handle: fromRichText(p["Handle"]),
    link: fromRichText(p["Link"]),
    mediums: fromMultiSelect(p["Medium"]),
    styles: fromMultiSelect(p["Style"]),
    remind: fromRichText(p["Remind"]),
    addedBy: fromRichText(p["Added By"]),
  };
}

async function createArtist({ name, handle, link, mediums, styles, remind, addedBy }) {
  const page = await notion.pages.create({
    parent: { database_id: DB_ID },
    properties: {
      Name: { title: [{ text: { content: name || handle || "Unknown" } }] },
      Handle: { rich_text: [{ text: { content: handle || "" } }] },
      Link: { rich_text: [{ text: { content: link || "" } }] },
      Medium: { multi_select: toMultiSelect(mediums) },
      Style: { multi_select: toMultiSelect(styles) },
      Remind: { rich_text: [{ text: { content: remind || "" } }] },
      "Added By": { rich_text: [{ text: { content: addedBy || "" } }] },
    },
  });
  return pageToArtist(page);
}

async function getAllArtists() {
  const results = [];
  let cursor;
  const dbId = DB_ID.replace(/-/g, "");
  do {
    const res = await notion.search({
      filter: { property: "object", value: "page" },
      start_cursor: cursor,
      page_size: 100,
    });
    const pages = res.results.filter(
      (p) => p.object === "page" &&
        p.parent?.database_id?.replace(/-/g, "") === dbId
    );
    results.push(...pages.map(pageToArtist));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

async function updateArtist(pageId, { name, handle, link, mediums, styles, remind }) {
  const properties = {};
  if (name !== undefined)
    properties["Name"] = { title: [{ text: { content: name } }] };
  if (handle !== undefined)
    properties["Handle"] = { rich_text: [{ text: { content: handle } }] };
  if (link !== undefined)
    properties["Link"] = { rich_text: [{ text: { content: link || "" } }] };
  if (mediums !== undefined)
    properties["Medium"] = { multi_select: toMultiSelect(mediums) };
  if (styles !== undefined)
    properties["Style"] = { multi_select: toMultiSelect(styles) };
  if (remind !== undefined)
    properties["Remind"] = { rich_text: [{ text: { content: remind || "" } }] };
  const page = await notion.pages.update({ page_id: pageId, properties });
  return pageToArtist(page);
}

async function findByHandle(handle) {
  const clean = handle.replace(/^@/, "").toLowerCase();
  const all = await getAllArtists();
  return all.find((a) => a.handle.replace(/^@/, "").toLowerCase() === clean);
}

module.exports = { createArtist, getAllArtists, updateArtist, findByHandle };
