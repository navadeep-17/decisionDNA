import { NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { REDIS_DRIFT_QUERY, reflectOnDecision } from "@/lib/hindsight/queries";

export const runtime = "nodejs";

const DRIFT_RECALL_QUERY = `
Find the organizational evidence needed to review NovaPay decision DEC-021 about checkout session storage.
Prioritize memories about:
- DEC-021 and why self-managed Redis was rejected,
- incident INC-142,
- operational burden, memory pressure, staffing/headcount, and reliability constraints,
- any explicit condition under which Redis could be reconsidered,
- the later adoption and outcome of managed Redis Cloud,
- evidence showing whether the original constraints changed.
`.trim();

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

    const recalled = await client.recall(DECISIONDNA_BANK_ID, DRIFT_RECALL_QUERY, {
      limit: 12,
      budget: "high",
    });

    if (!recalled.results.length) {
      return NextResponse.json(
        {
          ok: false,
          stage: "recall",
          bankId: DECISIONDNA_BANK_ID,
          memoryTotal: memories.total,
          evidenceCount: 0,
          error:
            "The bank contains memories, but targeted Hindsight recall returned no evidence for DEC-021. Inspect the bank and retrieval configuration before retrying.",
        },
        { status: 422 },
      );
    }

    const evidence = recalled.results.map((item, index) => ({
      rank: index + 1,
      text: item.text,
      type: item.type,
      score: item.score,
    }));

    const evidenceBlock = evidence
      .map((item) => `[Memory ${item.rank}] ${item.text}`)
      .join("\n\n");

    const result = await reflectOnDecision(`
${REDIS_DRIFT_QUERY}

Hindsight has already recalled the following organizational evidence from the active NovaPay memory bank. Treat these memories as the evidence base for your analysis. Do not say there is no organizational history if the evidence below contains relevant facts.

${evidenceBlock}

Return a concise review with these sections:
- Original decision
- Original rationale and constraints
- Later evidence
- Which assumption changed
- Review status
- Why

The review status must be one of: STILL_VALID, REVIEW_SUGGESTED, or INSUFFICIENT_EVIDENCE.
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
      {
        ok: false,
        stage: "preflight-recall-or-reflect",
        bankId: DECISIONDNA_BANK_ID,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
