import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

type Result = { url: string } | { error: string; status: number };

// Verifies a Telegram Login Widget payload, then mints a Supabase session
// (synthetic email account) and returns a one-time action link to sign in.
async function createActionLink(body: Record<string, unknown>, redirectTo?: string): Promise<Result> {
  if (!TOKEN) return { error: "not_configured", status: 500 };

  const hash = body.hash as string | undefined;
  if (!hash) return { error: "no_hash", status: 400 };

  // build the data-check-string from every Telegram field except hash/redirectTo
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === "hash" || k === "redirectTo" || v == null) continue;
    data[k] = String(v);
  }
  const checkString = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join("\n");
  const secretKey = crypto.createHash("sha256").update(TOKEN).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
  const a = Buffer.from(hmac);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { error: "bad_hash", status: 401 };
  if (data.auth_date && Date.now() / 1000 - Number(data.auth_date) > 86400) return { error: "expired", status: 401 };

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

  const { data: link, error } = await sb.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  if (error || !link?.properties?.action_link) return { error: error?.message || "link_failed", status: 500 };
  return { url: link.properties.action_link };
}

// only honor a same-origin redirect (prevents open-redirect / session leak to other sites)
function sameOrigin(redirectTo: unknown, reqOrigin: string | null): string | undefined {
  if (typeof redirectTo === "string" && reqOrigin) {
    try { if (new URL(redirectTo).origin === reqOrigin) return redirectTo; } catch { /* ignore bad url */ }
  }
  return undefined;
}

// JSON POST — custom popup flow (window.Telegram.Login.auth callback).
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const r = await createActionLink(body, sameOrigin(body.redirectTo, req.headers.get("origin")));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ url: r.url });
}

// GET redirect — official embedded widget flow (data-auth-url). Telegram redirects the whole
// browser here with the auth fields as query params; we verify and bounce to the magic link.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const body = Object.fromEntries(url.searchParams.entries());
  const r = await createActionLink(body, url.origin);
  if ("error" in r) {
    const back = new URL("/", url.origin);
    back.searchParams.set("tg_auth_error", r.error);
    return NextResponse.redirect(back);
  }
  return NextResponse.redirect(r.url);
}
