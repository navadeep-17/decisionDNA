import { NextRequest, NextResponse } from "next/server";
import { seedNovaPayRedisHistory } from "@/lib/hindsight/seed";
import { requireSupabaseUser } from "@/lib/supabase/require-user";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const result = await seedNovaPayRedisHistory();
    return NextResponse.json({
      ok: true,
      retained: result.events.length,
      memoryTotal: result.memoryTotal,
      events: result.events,
      retainResult: result.retainResult,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
