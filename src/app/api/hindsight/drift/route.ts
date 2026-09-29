import { NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { REDIS_DRIFT_QUERY, reflectOnDecision } from "@/lib/hindsight/queries";

export const runtime = "nodejs";

export async function POST() {
  try {
    const client = getHindsightClient();
    const memories = await client.listMemories(DECISIONDNA_BANK_ID, {
      limit: 5,
      offset: 0,
    });

    if (memories.total === 0) {
      return NextResponse.json(
        {
          ok: false,
          stage: "preflight",
          bankId: DECISIONDNA_BANK_ID,
          memoryTotal: 0,
          error:
            "Decision Drift cannot run because the active Hindsight bank is empty. Run Setup Bank, then Seed Redis History, then Inspect Bank before retrying.",
        },
        { status: 409 },
      );
    }

    const result = await reflectOnDecision(REDIS_DRIFT_QUERY);
    return NextResponse.json({
      ok: true,
      bankId: DECISIONDNA_BANK_ID,
      memoryTotal: memories.total,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "preflight-or-reflect",
        bankId: DECISIONDNA_BANK_ID,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
