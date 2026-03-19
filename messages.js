// ── Score bar ──────────────────────────────────────────────────────────────

function scoreBar(score) {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${score}%`;
}

// ── Format artist for display ──────────────────────────────────────────────

function formatArtist(artist) {
  const name = artist.name || artist.handle || "Unknown";
  const handle = artist.handle ? `· @${artist.handle.replace(/^@/, "")}` : "";
  const medium = artist.mediums?.join(" · ") || "—";
  const style = artist.styles?.join(" · ") || "—";
  const link = artist.link || "—";

  return `${name} ${handle}\nMedium: ${medium}\nStyle:  ${style}\nLink:   ${link}`;
}

// ── Messages ───────────────────────────────────────────────────────────────

function msgConfirm(artist) {
  const name = artist.name || artist.handle || "Unknown";
  const handle = artist.handle ? `· @${artist.handle.replace(/^@/, "")}` : "";
  return (
    `Thông tin artist:\n` +
    `Tên:    ${name} ${handle}\n` +
    `Medium: ${artist.mediums?.join(" · ") || "—"}\n` +
    `Style:  ${artist.styles?.join(" · ") || "—"}\n` +
    `Link:   ${artist.link || "—"}`
  );
}

function msgSavedOk(artist) {
  return `✅ Đã lưu ${artist.name || artist.handle}`;
}

function msgUpdatedOk(handle, changed) {
  const lines = Object.entries(changed)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" · ") : v}`)
    .join("\n");
  return `✅ Đã cập nhật @${handle.replace(/^@/, "")}\n${lines}`;
}

function msgAskMedium() {
  return "Artist sử dụng medium nào?\n\nKhông có trong danh sách? Nhập: m: tên medium";
}

function msgAskStyle() {
  return "Style như thế nào?\n\nKhông có trong danh sách? Nhập: s: tên style";
}

function msgAskBoth() {
  return (
    "Điền style và medium theo format:\n" +
    "m: medium, medium  s: style, style\n\n" +
    "Ví dụ: m: illustration, motion  s: dark, maximalism"
  );
}

function msgEditMenu(artist) {
  const name = artist.name || artist.handle || "Unknown";
  const handle = artist.handle ? artist.handle.replace(/^@/, "") : "";
  return (
    `Artist @${handle}\n` +
    `Tên:    ${name}\n` +
    `Medium: ${artist.mediums?.join(" · ") || "—"}\n` +
    `Style:  ${artist.styles?.join(" · ") || "—"}\n` +
    `Link:   ${artist.link || "—"}\n\n` +
    `Bạn muốn sửa thông tin nào?`
  );
}

function msgEditMedium(current = []) {
  const currentStr = current.length ? current.join(" · ") : "chưa có";
  return `Artist sử dụng medium nào?\nHiện tại: ${currentStr}\n\nKhông có trong danh sách? Nhập: m: tên medium`;
}

function msgEditStyle(current = []) {
  const currentStr = current.length ? current.join(" · ") : "chưa có";
  return `Style như thế nào?\nHiện tại: ${currentStr}\n\nKhông có trong danh sách? Nhập: s: tên style`;
}

function msgFindResults(results) {
  if (!results.length) return null;
  const lines = results.map((r, i) => {
    const a = r.artist;
    const name = a.name || a.handle || "Unknown";
    const handle = a.handle ? `· @${a.handle.replace(/^@/, "")}` : "";
    return (
      `${i + 1}. ${name} ${handle}\n` +
      `   Medium: ${a.mediums?.join(" · ") || "—"}\n` +
      `   Style:  ${a.styles?.join(" · ") || "—"}\n` +
      `   ${a.link || "—"}\n` +
      `   ${scoreBar(r.score)}`
    );
  });
  return `🔍 ${results.length} kết quả:\n\n` + lines.join("\n\n");
}

function msgFindEmpty(query) {
  return `🔍 Không tìm thấy ai phù hợp với "${query}"`;
}

function msgUnknown() {
  return (
    "Không hiểu định dạng. Thử:\n\n" +
    "instagram.com/handle m: medium s: style\n" +
    "Hoặc /find để tìm · /edit @handle để sửa"
  );
}

function msgHelp(notionUrl) {
  return (
    "Artist Rolodex 📋\n\n" +
    "Lưu artist mới:\n" +
    "[link] n: tên  m: medium, medium  s: style, style\n\n" +
    "n: tên thật (không bắt buộc)\n" +
    "m: medium (bắt buộc)\n" +
    "s: style (bắt buộc)\n\n" +
    "Ví dụ:\n" +
    "instagram.com/kuken.dr n: Khang Dương m: illustration s: dark, maximalism\n\n" +
    "──────────────────\n" +
    "/find [từ khoá]   Tìm theo tên, medium, style\n" +
    "/edit @handle     Sửa thông tin artist\n" +
    "/help             Hướng dẫn"
  );
}

// ── Keyboards ──────────────────────────────────────────────────────────────

const MEDIUMS = ["Illustration", "3D", "Motion", "Branding", "Print", "Photo"];
const STYLES = ["Dark", "Minimal", "Organic", "Playful", "Maximalism", "Editorial", "Surreal"];

function kbConfirm() {
  return {
    inline_keyboard: [
      [
        { text: "✓ Lưu", callback_data: "confirm:save" },
        { text: "Sửa medium", callback_data: "confirm:edit_medium" },
        { text: "Sửa style", callback_data: "confirm:edit_style" },
      ],
    ],
  };
}

function kbMedium(selected = []) {
  const selectedLower = selected.map((s) => s.toLowerCase());
  return {
    inline_keyboard: [
      MEDIUMS.map((m) => ({
        text: selectedLower.includes(m.toLowerCase()) ? `${m} ✓` : m,
        callback_data: `medium:${m.toLowerCase()}`,
      })),
      [{ text: "✓ Xong", callback_data: "medium:done" }],
    ],
  };
}

function kbStyle(selected = []) {
  const selectedLower = selected.map((s) => s.toLowerCase());
  const rows = [];
  for (let i = 0; i < STYLES.length; i += 4) {
    rows.push(
      STYLES.slice(i, i + 4).map((s) => ({
        text: selectedLower.includes(s.toLowerCase()) ? `${s} ✓` : s,
        callback_data: `style:${s.toLowerCase()}`,
      }))
    );
  }
  rows.push([{ text: "✓ Xong", callback_data: "style:done" }]);
  return { inline_keyboard: rows };
}

function kbEditMenu() {
  return {
    inline_keyboard: [
      [
        { text: "Tên", callback_data: "edit:name" },
        { text: "Medium", callback_data: "edit:medium" },
        { text: "Style", callback_data: "edit:style" },
        { text: "Link", callback_data: "edit:link" },
      ],
    ],
  };
}

function kbNotionLink(url) {
  return {
    inline_keyboard: [[{ text: "Xem trên Notion →", url }]],
  };
}

module.exports = {
  msgConfirm, msgSavedOk, msgUpdatedOk,
  msgAskMedium, msgAskStyle, msgAskBoth,
  msgEditMenu, msgEditMedium, msgEditStyle,
  msgFindResults, msgFindEmpty,
  msgUnknown, msgHelp,
  kbConfirm, kbMedium, kbStyle, kbEditMenu, kbNotionLink,
  MEDIUMS, STYLES,
};
