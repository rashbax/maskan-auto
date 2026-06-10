import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { presignPut, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";

// Returns a presigned R2 upload URL. Admin only (verified via the Supabase session).
export async function POST(req: Request) {
  if (!r2Configured()) return NextResponse.json({ error: "r2_not_configured" }, { status: 503 });

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { apartmentId?: string; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const ct = typeof body.contentType === "string" ? body.contentType : "image/webp";
  const ext = ct.includes("webp") ? "webp" : ct.includes("png") ? "png" : "jpg";
  const key = `apartments/${body.apartmentId || "misc"}/${randomUUID()}.${ext}`;
  const { url, publicUrl } = await presignPut(key, ct);
  return NextResponse.json({ url, publicUrl });
}
