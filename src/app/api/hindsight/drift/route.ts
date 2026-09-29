import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { REDIS_DRIFT_QUERY, reflectOnDecision } from "@/lib/hindsight/queries";
import { requireSupabaseUser } from "@/lib/supabase/require-user";

export const runtime = "nodejs";

const DRIFT_RECALL_QUERY = `
Find the organizational evidence needed to review NovaPay decision DEC-021 about checkout session storage.
Prioritize memories about DEC-021, INC-142, operational burden, memory pressure, staffing constraints, explicit reconsideration conditions, and the later managed Redis Cloud outcomes.
`.trim();

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const client = getHindsightClient();
    const memories = await client.listMemories(DECISIONDNA_BANK_ID, { limit: 5, offset: 0 });

    if (memories.total === 0) {
      return NextResponse.json(
        { ok: false, stage: "preflight", bankId: DECISIONDNA_BANK_ID, memoryTotal: 0, error: "The active Hindsight bank is empty." },
        { status: 409 },
      );
    }

    const recalled = await client.recall(DECISIONDNA_BANK_ID, DRIFT_RECALL_QUERY, {
      limit: 12,
      budget: "high",
    });

    if (!recalled.results.length) {
      return NextResponse.json(
        { ok: false, stage: "recall", bankId: DECISIONDNA_BANK_ID, memoryTotal: memories.total, evidenceCount: 0, error: "Targeted Hindsight recall returned no DEC-021 evidence." },
        { status: 422 },
      );
    }

    const evidence = recalled.results.map((item, index) => ({
      rank: index + 1,
      text: item.text,
      type: item.type,
      score: item.score,
    }));

    const evidenceBlock = evidence.map((item) => `[Memory ${item.rank}] ${item.text}`).join("\n\n");

    const result = await reflectOnDecision(`
${REDIS_DRIFT_QUERY}

Use the recalled evidence below as the evidence base for the review.

${evidenceBlock}

Return these sections: Original decision, Original rationale and constraints, Later evidence, Which assumption changed, Review status, Why.
The review status must be one of STILL_VALID, REVIEW_SUGGESTED, or INSUFFICIENT_EVIDENCE.
`.trim());

    return NextResponse.json({
      ok: true,
      bankId: DECISIONDNA_BANK_ID,
      memoryTotal: memories.total,
      evidenceCount: evidence.length,
      evidence,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, stage: "preflight-recall-or-reflect", bankId: DECISIONDNA_BANK_ID, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
