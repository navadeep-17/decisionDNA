import { NextResponse } from "next/server";
import { seedNovaPayRedisHistory } from "@/lib/hindsight/seed";

export const runtime = "nodejs";

export async function POST() {
  try {
    const events = await seedNovaPayRedisHistory();
    return NextResponse.json({ ok: true, retained: events.length, events });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
