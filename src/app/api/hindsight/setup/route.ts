import { NextResponse } from "next/server";
import { setupDecisionDnaBank } from "@/lib/hindsight/setup";

export const runtime = "nodejs";

export async function POST() {
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
