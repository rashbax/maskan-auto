// Single printable line for guest-supplied text that gets echoed into Telegram notices
// (lib/booking-effects). The admin reply-relay (app/api/telegram/webhook) resolves its
// destination chat from a line-anchored "🆔 <chatId>" inside the quoted notice, so a guest
// name/phone/handle carrying "🆔 <digits>" (or an embedded newline that fakes a line start)
// could redirect an admin's reply — key codes, the address — to a chat the booker chose.
// Strip the marker, collapse ALL whitespace to single spaces, and bound the length.
// Empty/undefined in → "" out (callers null-coalesce where the column is nullable).
export function oneLine(v: unknown, max: number): string {
  return String(v ?? "")
    .replace(/🆔/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}
