// Sends a test message. Run: node --env-file=.env.local scripts/tg-test.mjs
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_OWNER_CHAT_ID;
if (!TOKEN || !CHAT) { console.error("❌ TELEGRAM_BOT_TOKEN yoki TELEGRAM_OWNER_CHAT_ID .env.local da yo'q"); process.exit(1); }

const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: CHAT, text: "✅ Maskan bot ulandi — bu test xabar. Yangi bronlar shu yerga keladi." }),
});
const j = await r.json();
console.log(j.ok ? "✅ Test xabar yuborildi! Telegram'ni tekshiring." : "❌ Xato: " + j.description);
