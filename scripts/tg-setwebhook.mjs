// Registers the Telegram webhook. Run: node --env-file=.env.local scripts/tg-setwebhook.mjs
// Optional: WEBHOOK_URL env to override (defaults to the live Vercel URL).
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const URL = process.env.WEBHOOK_URL || "https://maskan-24.uz/api/telegram/webhook";
if (!TOKEN) { console.error("❌ TELEGRAM_BOT_TOKEN .env.local da yo'q"); process.exit(1); }

const body = { url: URL, allowed_updates: ["message"], drop_pending_updates: true };
if (SECRET) body.secret_token = SECRET;

const r = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const j = await r.json();
console.log(j.ok ? `✅ Webhook o'rnatildi: ${URL}${SECRET ? "  (secret bilan)" : "  (secretsiz)"}` : "❌ " + j.description);

const info = await (await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`)).json();
console.log("Holat:", JSON.stringify(info.result));
