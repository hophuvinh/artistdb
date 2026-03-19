require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { parseArtistInput, searchArtists } = require("./ai");
const { createArtist, getAllArtists, updateArtist, findByHandle } = require("./notion");
const {
  msgConfirm, msgSavedOk, msgUpdatedOk,
  msgAskMedium, msgAskStyle, msgAskBoth,
  msgEditMenu, msgEditMedium, msgEditStyle,
  msgFindResults, msgFindEmpty,
  msgUnknown, msgHelp,
  kbConfirm, kbMedium, kbStyle, kbEditMenu, kbNotionLink, kbFindResults,
} = require("./messages");

const NOTION_DB_URL = `https://notion.so/${(process.env.NOTION_DB_ID || "").replace(/-/g, "")}`;

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

// ── Session store (in-memory) ─────────────────────────────────────────────
// state: 'confirm' | 'ask_medium' | 'ask_style' | 'ask_both'
//      | 'edit_menu' | 'edit_medium' | 'edit_style' | 'edit_name' | 'edit_link'
const sessions = {};

function getSession(chatId) {
  if (!sessions[chatId]) sessions[chatId] = {};
  return sessions[chatId];
}

function clearSession(chatId) {
  sessions[chatId] = {};
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mergeTags(existing = [], added = []) {
  const all = [...existing, ...added].map((t) => t.toLowerCase().trim());
  return [...new Set(all)];
}

function parsePrefixTags(text, prefix) {
  const re = new RegExp(`${prefix}:\\s*([^ms:]+?)(?=\\s+[ms]:|$)`, "i");
  const match = text.match(re);
  if (!match) return [];
  return match[1].split(",").map((t) => t.trim()).filter(Boolean);
}

// ── /start ─────────────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, msgHelp(NOTION_DB_URL), {
    reply_markup: kbNotionLink(NOTION_DB_URL),
  });
});

// ── /help ──────────────────────────────────────────────────────────────────

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, msgHelp(NOTION_DB_URL), {
    reply_markup: kbNotionLink(NOTION_DB_URL),
  });
});

// ── /find ──────────────────────────────────────────────────────────────────

bot.onText(/\/find (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1].trim();

  const thinking = await bot.sendMessage(chatId, "🔍 Đang tìm...");

  try {
    const all = await getAllArtists();
    const results = await searchArtists(query, all);

    await bot.deleteMessage(chatId, thinking.message_id);

    if (!results.length) {
      bot.sendMessage(chatId, msgFindEmpty(query));
    } else {
      bot.sendMessage(chatId, msgFindResults(results), {
        reply_markup: kbFindResults(results),
      });
    }
  } catch (err) {
    console.error(err);
    await bot.deleteMessage(chatId, thinking.message_id);
    bot.sendMessage(chatId, "❌ Lỗi khi tìm kiếm. Thử lại nhé.");
  }
});

// ── /edit ──────────────────────────────────────────────────────────────────

bot.onText(/\/edit (@?\S+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const handle = match[1];

  try {
    const artist = await findByHandle(handle);
    if (!artist) {
      bot.sendMessage(chatId, `Không tìm thấy @${handle.replace(/^@/, "")}`);
      return;
    }

    const s = getSession(chatId);
    s.state = "edit_menu";
    s.artist = artist;

    bot.sendMessage(chatId, msgEditMenu(artist), {
      reply_markup: kbEditMenu(),
    });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Lỗi. Thử lại nhé.");
  }
});

// ── Text handler — new artist input or session replies ────────────────────

bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const s = getSession(chatId);
  const from = msg.from?.username || msg.from?.first_name || "";

  // ── Handle session states ──────────────────────────────────────────────

  if (s.state === "ask_medium") {
    // User typed free m: tags
    const typed = parsePrefixTags(text, "m");
    if (typed.length) {
      s.draft.mediums = mergeTags(s.draft.mediums, typed);
    }
    if (!s.draft.styles?.length) {
      s.state = "ask_style";
      bot.sendMessage(chatId, msgAskStyle(), { reply_markup: kbStyle(s.draft.styles) });
    } else {
      s.state = "confirm";
      bot.sendMessage(chatId, msgConfirm(s.draft), { reply_markup: kbConfirm() });
    }
    return;
  }

  if (s.state === "ask_style") {
    const typed = parsePrefixTags(text, "s");
    if (typed.length) {
      s.draft.styles = mergeTags(s.draft.styles, typed);
    }
    s.state = "confirm";
    bot.sendMessage(chatId, msgConfirm(s.draft), { reply_markup: kbConfirm() });
    return;
  }

  if (s.state === "ask_both") {
    // User re-entered with m: s: format
    const mediums = parsePrefixTags(text, "m");
    const styles = parsePrefixTags(text, "s");
    if (mediums.length) s.draft.mediums = mediums;
    if (styles.length) s.draft.styles = styles;

    if (!s.draft.mediums?.length) {
      bot.sendMessage(chatId, msgAskMedium(), { reply_markup: kbMedium() });
      s.state = "ask_medium";
      return;
    }
    if (!s.draft.styles?.length) {
      bot.sendMessage(chatId, msgAskStyle(), { reply_markup: kbStyle() });
      s.state = "ask_style";
      return;
    }
    s.state = "confirm";
    bot.sendMessage(chatId, msgConfirm(s.draft), { reply_markup: kbConfirm() });
    return;
  }

  if (s.state === "edit_medium") {
    const typed = parsePrefixTags(text, "m");
    if (typed.length) {
      s.editMediums = mergeTags(s.editMediums || [], typed);
      const updated = await updateArtist(s.artist.id, { mediums: s.editMediums });
      clearSession(chatId);
      bot.sendMessage(chatId, msgUpdatedOk(s.artist.handle, { Medium: s.editMediums }));
    }
    return;
  }

  if (s.state === "edit_style") {
    const typed = parsePrefixTags(text, "s");
    if (typed.length) {
      s.editStyles = mergeTags(s.editStyles || [], typed);
      await updateArtist(s.artist.id, { styles: s.editStyles });
      clearSession(chatId);
      bot.sendMessage(chatId, msgUpdatedOk(s.artist.handle, { Style: s.editStyles }));
    }
    return;
  }

  if (s.state === "edit_name") {
    await updateArtist(s.artist.id, { name: text });
    clearSession(chatId);
    bot.sendMessage(chatId, msgUpdatedOk(s.artist.handle, { Tên: text }));
    return;
  }

  if (s.state === "edit_link") {
    await updateArtist(s.artist.id, { link: text });
    clearSession(chatId);
    bot.sendMessage(chatId, msgUpdatedOk(s.artist.handle, { Link: text }));
    return;
  }

  if (s.state === "edit_remind") {
    await updateArtist(s.artist.id, { remind: text });
    clearSession(chatId);
    bot.sendMessage(chatId, msgUpdatedOk(s.artist.handle, { Remind: text }));
    return;
  }

  // ── New artist input ───────────────────────────────────────────────────

  const thinking = await bot.sendMessage(chatId, "⏳ Đang xử lý...");

  try {
    const parsed = await parseArtistInput(text);
    await bot.deleteMessage(chatId, thinking.message_id);

    if (!parsed) {
      bot.sendMessage(chatId, msgUnknown());
      return;
    }

    // Store draft in session
    s.draft = { ...parsed, addedBy: from };
    // parse r: remind from raw text
    if (!parsed.remind) {
      const remindMatch = text.match(/r:\s*(.+?)(?=\s+[msnr]:|$)/i);
      if (remindMatch) s.draft.remind = remindMatch[1].trim();
    }
    s.state = "confirm";

    const hasMedium = parsed.mediums?.length > 0;
    const hasStyle = parsed.styles?.length > 0;

    if (!hasMedium && !hasStyle) {
      s.state = "ask_both";
      bot.sendMessage(chatId, msgAskBoth());
      return;
    }

    if (!hasMedium) {
      s.state = "ask_medium";
      bot.sendMessage(chatId, msgAskMedium(), { reply_markup: kbMedium() });
      return;
    }

    if (!hasStyle) {
      s.state = "ask_style";
      bot.sendMessage(chatId, msgAskStyle(), { reply_markup: kbStyle() });
      return;
    }

    bot.sendMessage(chatId, msgConfirm(parsed), { reply_markup: kbConfirm() });
  } catch (err) {
    console.error(err);
    await bot.deleteMessage(chatId, thinking.message_id);
    bot.sendMessage(chatId, "❌ Lỗi. Thử lại nhé.");
  }
});

// ── Callback query handler ────────────────────────────────────────────────

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const s = getSession(chatId);

  bot.answerCallbackQuery(query.id);

  // ── Confirm buttons ──────────────────────────────────────────────────

  if (data === "confirm:save") {
    try {
      if (!s.draft) {
        bot.sendMessage(chatId, "❌ Không tìm thấy dữ liệu. Thử nhập lại nhé.");
        return;
      }
      const artist = await createArtist(s.draft);
      clearSession(chatId);
      bot.sendMessage(chatId, msgSavedOk(artist), {
        reply_markup: kbNotionLink(NOTION_DB_URL),
      });
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, `❌ Lưu thất bại:\n${err.message || err}`);
    }
    return;
  }

  if (data === "confirm:edit_medium") {
    s.state = "ask_medium";
    bot.sendMessage(chatId, msgAskMedium(), {
      reply_markup: kbMedium(s.draft?.mediums || []),
    });
    return;
  }

  if (data === "confirm:edit_style") {
    s.state = "ask_style";
    bot.sendMessage(chatId, msgAskStyle(), {
      reply_markup: kbStyle(s.draft?.styles || []),
    });
    return;
  }

  // ── Medium buttons ───────────────────────────────────────────────────

  if (data.startsWith("medium:")) {
    const val = data.replace("medium:", "");

    if (val === "done") {
      // Finished selecting medium
      if (s.state === "edit_medium") {
        await updateArtist(s.artist.id, { mediums: s.editMediums || [] });
        clearSession(chatId);
        bot.sendMessage(chatId, msgUpdatedOk(s.artist.handle, { Medium: s.editMediums || [] }));
      } else {
        // Back to confirm or ask style
        if (!s.draft.styles?.length) {
          s.state = "ask_style";
          bot.sendMessage(chatId, msgAskStyle(), { reply_markup: kbStyle() });
        } else {
          s.state = "confirm";
          bot.sendMessage(chatId, msgConfirm(s.draft), { reply_markup: kbConfirm() });
        }
      }
      return;
    }

    // Toggle selection
    if (s.state === "edit_medium") {
      s.editMediums = s.editMediums || [...(s.artist?.mediums || [])];
      const idx = s.editMediums.map((m) => m.toLowerCase()).indexOf(val);
      if (idx >= 0) s.editMediums.splice(idx, 1);
      else s.editMediums.push(val);
      bot.editMessageReplyMarkup(kbMedium(s.editMediums), {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
    } else {
      s.draft = s.draft || {};
      s.draft.mediums = s.draft.mediums || [];
      const idx = s.draft.mediums.map((m) => m.toLowerCase()).indexOf(val);
      if (idx >= 0) s.draft.mediums.splice(idx, 1);
      else s.draft.mediums.push(val);
      bot.editMessageReplyMarkup(kbMedium(s.draft.mediums), {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
    }
    return;
  }

  // ── Style buttons ────────────────────────────────────────────────────

  if (data.startsWith("style:")) {
    const val = data.replace("style:", "");

    if (val === "done") {
      if (s.state === "edit_style") {
        await updateArtist(s.artist.id, { styles: s.editStyles || [] });
        clearSession(chatId);
        bot.sendMessage(chatId, msgUpdatedOk(s.artist.handle, { Style: s.editStyles || [] }));
      } else {
        s.state = "confirm";
        bot.sendMessage(chatId, msgConfirm(s.draft), { reply_markup: kbConfirm() });
      }
      return;
    }

    if (s.state === "edit_style") {
      s.editStyles = s.editStyles || [...(s.artist?.styles || [])];
      const idx = s.editStyles.map((m) => m.toLowerCase()).indexOf(val);
      if (idx >= 0) s.editStyles.splice(idx, 1);
      else s.editStyles.push(val);
      bot.editMessageReplyMarkup(kbStyle(s.editStyles), {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
    } else {
      s.draft = s.draft || {};
      s.draft.styles = s.draft.styles || [];
      const idx = s.draft.styles.map((m) => m.toLowerCase()).indexOf(val);
      if (idx >= 0) s.draft.styles.splice(idx, 1);
      else s.draft.styles.push(val);
      bot.editMessageReplyMarkup(kbStyle(s.draft.styles), {
        chat_id: chatId,
        message_id: query.message.message_id,
      });
    }
    return;
  }

  // ── Edit menu buttons ────────────────────────────────────────────────

  if (data === "edit:medium") {
    s.state = "edit_medium";
    s.editMediums = [...(s.artist?.mediums || [])];
    bot.sendMessage(chatId, msgEditMedium(s.artist?.mediums), {
      reply_markup: kbMedium(s.artist?.mediums || []),
    });
    return;
  }

  if (data === "edit:style") {
    s.state = "edit_style";
    s.editStyles = [...(s.artist?.styles || [])];
    bot.sendMessage(chatId, msgEditStyle(s.artist?.styles), {
      reply_markup: kbStyle(s.artist?.styles || []),
    });
    return;
  }

  if (data === "edit:name") {
    s.state = "edit_name";
    bot.sendMessage(chatId, "Tên mới là gì?");
    return;
  }

  if (data === "edit:link") {
    s.state = "edit_link";
    bot.sendMessage(chatId, "Link mới là gì?");
    return;
  }

  if (data === "edit:remind") {
    s.state = "edit_remind";
    const current = s.artist?.remind ? `\nHiện tại: ${s.artist.remind}` : "";
    bot.sendMessage(chatId, `Remind mới là gì?${current}`);
    return;
  }

  if (data.startsWith("find_edit:")) {
    const parts = data.split(":");
    const pageId = parts[1];
    const handle = parts[2] || "";
    try {
      const all = await getAllArtists();
      const artist = all.find((a) => a.id === pageId);
      if (!artist) {
        bot.sendMessage(chatId, `Không tìm thấy artist.`);
        return;
      }
      const s2 = getSession(chatId);
      s2.state = "edit_menu";
      s2.artist = artist;
      bot.sendMessage(chatId, msgEditMenu(artist), { reply_markup: kbEditMenu() });
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, "❌ Lỗi. Thử lại nhé.");
    }
    return;
  }
});

console.log("🤖 Artist Rolodex bot đang chạy...");
