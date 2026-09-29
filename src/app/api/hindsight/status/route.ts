import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const client = getHindsightClient();
    const memories = await client.listMemories(DECISIONDNA_BANK_ID, {
      limit: 25,
      offset: 0,
    });

    return NextResponse.json({
      ok: true,
      bankId: DECISIONDNA_BANK_ID,
      total: memories.total,
      items: memories.items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        bankId: DECISIONDNA_BANK_ID,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
