import { createAdminClient } from "@/lib/supabase/admin";

type TgUser = { id: string; first_name?: string | null; last_name?: string | null; username?: string | null; photo_url?: string | null };

// Create (or reuse) the synthetic-email account for a verified Telegram user and
// return a one-time Supabase magic link the browser can redirect to, to sign in.
export async function mintTelegramSession(tg: TgUser, redirectTo?: string): Promise<string | null> {
  const sb = createAdminClient();
  const email = `tg${tg.id}@telegram.maskan`;
  const fullName = [tg.first_name, tg.last_name].filter(Boolean).join(" ");

  await sb.auth.admin
    .createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        name: tg.first_name,
        user_name: tg.username,
        avatar_url: tg.photo_url,
        telegram_id: tg.id,
      },
      app_metadata: { provider: "telegram" },
    })
    .catch(() => {}); // ignore "already registered"

  const { data: link, error } = await sb.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  if (error || !link?.properties?.action_link) return null;
  // refuse if the account at this synthetic email wasn't created by the Telegram flow (email squatting)
  if (String((link.user?.user_metadata as { telegram_id?: string } | undefined)?.telegram_id ?? "") !== String(tg.id)) return null;
  return link.properties.action_link;
}
