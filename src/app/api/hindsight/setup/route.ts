import { NextRequest, NextResponse } from "next/server";
import { setupDecisionDnaBank } from "@/lib/hindsight/setup";
import { requireSupabaseUser } from "@/lib/supabase/require-user";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const bank = await setupDecisionDnaBank();
    return NextResponse.json({ ok: true, bank });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
