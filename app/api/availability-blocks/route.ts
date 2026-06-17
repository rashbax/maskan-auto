import { NextResponse } from "next/server";
import { cancelBlockInBeds24, pushBlockToBeds24 } from "@/lib/booking-effects";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Payload = {
  apartmentId?: string;
  date?: string;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin";
}

async function readPayload(req: Request) {
  try {
    return (await req.json()) as Payload;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return json({ error: "forbidden" }, 403);
  const body = await readPayload(req);
  if (!body?.apartmentId || !validDate(body.date)) return json({ error: "bad_payload" }, 400);

  const admin = createAdminClient();
  let created = false;
  let block: { id: string; apartment_id: string; date: string; beds24_booking_id: string | null } | null = null;

  const inserted = await admin
    .from("availability_blocks")
    .insert({ apartment_id: body.apartmentId, date: body.date })
    .select("id,apartment_id,date,beds24_booking_id")
    .single();

  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const existing = await admin
        .from("availability_blocks")
        .select("id,apartment_id,date,beds24_booking_id")
        .eq("apartment_id", body.apartmentId)
        .eq("date", body.date)
        .maybeSingle();
      if (existing.error || !existing.data) return json({ error: "lookup_failed" }, 500);
      block = existing.data;
    } else if (inserted.error.code === "23B01" || inserted.error.code === "check_violation") {
      return json({ error: "date_has_booking", code: "23B01" }, 409);
    } else {
      return json({ error: "insert_failed", code: inserted.error.code }, 500);
    }
  } else {
    created = true;
    block = inserted.data;
  }

  const beds24 = await pushBlockToBeds24(block.id);
  if (!beds24.ok) {
    if (created) await admin.from("availability_blocks").delete().eq("id", block.id);
    return json({ error: "beds24_block_failed", beds24 }, 502);
  }

  return json({ ok: true, block, beds24 });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return json({ error: "forbidden" }, 403);
  const body = await readPayload(req);
  if (!body?.apartmentId || !validDate(body.date)) return json({ error: "bad_payload" }, 400);

  const admin = createAdminClient();
  const { data: block, error: lookupError } = await admin
    .from("availability_blocks")
    .select("id")
    .eq("apartment_id", body.apartmentId)
    .eq("date", body.date)
    .maybeSingle();
  if (lookupError) return json({ error: "lookup_failed" }, 500);
  if (!block) return json({ ok: true, beds24: { ok: true, skipped: "not_found" } });

  const beds24 = await cancelBlockInBeds24(block.id);
  if (!beds24.ok) return json({ error: "beds24_unblock_failed", beds24 }, 502);

  const { error } = await admin.from("availability_blocks").delete().eq("id", block.id);
  if (error) return json({ error: "delete_failed" }, 500);
  return json({ ok: true, beds24 });
}
