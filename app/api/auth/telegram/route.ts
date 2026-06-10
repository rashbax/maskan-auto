import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Verifies a Telegram Login Widget payload, then mints a Supabase session
// (synthetic email account) and returns a one-time action link to sign in.
export async function POST(req: Request) {
  if (!TOKEN) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const hash = body.hash as string | undefined;
  const redirectTo = body.redirectTo as string | undefined;
  if (!hash) return NextResponse.json({ error: "no_hash" }, { status: 400 });

  // build the data-check-string from every Telegram field except hash/redirectTo
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === "hash" || k === "redirectTo" || v == null) continue;
    data[k] = String(v);
  }
  const checkString = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join("\n");
  const secretKey = crypto.createHash("sha256").update(TOKEN).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  if (hmac !== hash) return NextResponse.json({ error: "bad_hash" }, { status: 401 });
  if (data.auth_date && Date.now() / 1000 - Number(data.auth_date) > 86400) {
    return NextResponse.json({ error: "expired" }, { status: 401 });
  }

  const sb = createAdminClient();
  const email = `tg${data.id}@telegram.maskan`;
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ");

  // create the account on first login (ignore "already registered")
  await sb.auth.admin
    .createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        name: data.first_name,
        user_name: data.username,
        avatar_url: data.photo_url,
        telegram_id: data.id,
      },
      app_metadata: { provider: "telegram" },
    })
    .catch(() => {});

  const { data: link, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: redirectTo || undefined },
  });
  if (error || !link?.properties?.action_link) {
    return NextResponse.json({ error: error?.message || "link_failed" }, { status: 500 });
  }
  return NextResponse.json({ url: link.properties.action_link });
}
