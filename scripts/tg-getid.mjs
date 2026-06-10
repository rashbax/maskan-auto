// Finds your chat_id. First send any message to your bot in Telegram, then run:
// node --env-file=.env.local scripts/tg-getid.mjs
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error("❌ TELEGRAM_BOT_TOKEN .env.local da yo'q"); process.exit(1); }

const r = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`);
const j = await r.json();
if (!j.ok) { console.error("❌ Telegram xato:", j.description); process.exit(1); }

const chats = new Map();
for (const u of j.result) {
  const m = u.message || u.edited_message || u.channel_post || u.my_chat_member;
  if (m?.chat) chats.set(m.chat.id, m.chat);
}
if (chats.size === 0) {
  console.log("Hali xabar yo'q. Telegram'da botingizni oching, /start yoki biror xabar yuboring, keyin shu skriptni qayta ishga tushiring.");
} else {
  console.log("Topilgan chatlar (TELEGRAM_OWNER_CHAT_ID uchun id'ni oling):");
  for (const [id, c] of chats) console.log(`  chat_id: ${id}   | ${c.first_name || c.title || ""} ${c.username ? "@" + c.username : ""}`.trimEnd());
}
