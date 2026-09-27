import { NextResponse } from "next/server";
import { REDIS_DRIFT_QUERY, reflectOnDecision } from "@/lib/hindsight/queries";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await reflectOnDecision(REDIS_DRIFT_QUERY);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
