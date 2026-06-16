import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cancelInBeds24 } from "@/lib/booking-effects";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin";
}

async function bookingExists(id: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("bookings").select("id").eq("id", id).maybeSingle();
  return !!data;
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!(await requireAdmin())) return json({ error: "forbidden" }, 403);
  const { id } = await ctx.params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (body.status !== "cancelled") return json({ error: "unsupported_status" }, 400);
  if (!(await bookingExists(id))) return json({ error: "not_found" }, 404);

  const beds24 = await cancelInBeds24(id);
  if (!beds24.ok) return json({ error: "beds24_cancel_failed", beds24 }, 502);

  const admin = createAdminClient();
  const { error } = await admin.from("bookings").update({ status: "cancelled" }).eq("id", id);
  if (error) return json({ error: "update_failed" }, 500);
  return json({ ok: true, beds24 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await requireAdmin())) return json({ error: "forbidden" }, 403);
  const { id } = await ctx.params;
  if (!(await bookingExists(id))) return json({ error: "not_found" }, 404);

  const beds24 = await cancelInBeds24(id);
  if (!beds24.ok) return json({ error: "beds24_cancel_failed", beds24 }, 502);

  const admin = createAdminClient();
  const { error } = await admin.from("bookings").delete().eq("id", id);
  if (error) return json({ error: "delete_failed" }, 500);
  return json({ ok: true, beds24 });
}
