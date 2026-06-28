// Admin Telegram accounts that receive booking notices and can answer guest messages.
// Set TELEGRAM_OWNER_CHAT_ID to a comma-separated list of chat ids to add more admins
// (a single value still works). A chat id is the number the bot replies with to /id.
export const ADMIN_CHAT_IDS = [
  ...new Set(
    (process.env.TELEGRAM_OWNER_CHAT_ID || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];

export const isAdmin = (chatId: string | number) => ADMIN_CHAT_IDS.includes(String(chatId));
