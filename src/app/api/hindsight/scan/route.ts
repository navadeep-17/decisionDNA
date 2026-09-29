import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";

export const runtime = "nodejs";

const ALLOWED_STATUSES = [
  "STILL_VALID",
  "REVIEW_SUGGESTED",
  "SUPERSEDED",
  "INSUFFICIENT_EVIDENCE",
] as const;

type ScanStatus = (typeof ALLOWED_STATUSES)[number];

type DecisionRow = {
  id: string;
  decision_key: string;
  title: string;
  summary: string | null;
  decision: string;
  rationale: string | null;
  status: string;
  decision_date: string;
};

function parseStatus(text: string): ScanStatus {
  const upper = text.toUpperCase();
  return (
    ALLOWED_STATUSES.find((status) =>
      upper.includes(`STATUS: ${status}`),
    ) || "INSUFFICIENT_EVIDENCE"
  );
}

function parseSummary(text: string) {
  const match = text.match(/SUMMARY:\s*(.+)/i);
  if (match?.[1]) return match[1].trim();

  return text
    .replace(/STATUS:\s*[A-Z_]+/i, "")
    .replace(/SUMMARY:/i, "")
    .trim()
    .split("\n")
    .filter(Boolean)[0] || "No summary returned.";
}

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user || !auth.token) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const supabase = createSupabaseUserClient(auth.token);
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, hindsight_bank_id")
      .eq("slug", "novapay")
      .single();

    if (orgError || !org) {
      throw orgError || new Error("NovaPay organization not found");
    }

    const { data: decisions, error: decisionsError } = await supabase
      .from("decisions")
      .select(
        "id, decision_key, title, summary, decision, rationale, status, decision_date",
      )
      .eq("organization_id", org.id)
      .order("decision_date", { ascending: true });

    if (decisionsError) throw decisionsError;

    const decisionRows = (decisions || []) as DecisionRow[];
    if (!decisionRows.length) {
      return NextResponse.json({
        ok: true,
        scanned: 0,
        counts: {
          STILL_VALID: 0,
          REVIEW_SUGGESTED: 0,
          SUPERSEDED: 0,
          INSUFFICIENT_EVIDENCE: 0,
        },
        results: [],
      });
    }

    const hindsight = getHindsightClient();
    const results = [];

    for (const decision of decisionRows) {
      const recallQuery = `
Review the organizational history relevant to ${decision.decision_key}: ${decision.title}.

Decision record:
- Decision: ${decision.decision}
- Original rationale: ${decision.rationale || "not recorded"}
- Date: ${decision.decision_date}

Find evidence about:
- why this decision was made,
- assumptions and constraints behind it,
- incidents or outcomes that supported or contradicted it,
- later organizational changes that may invalidate an assumption,
- later decisions that explicitly replaced or superseded it.
`.trim();

      const recalled = await hindsight.recall(
        org.hindsight_bank_id || DECISIONDNA_BANK_ID,
        recallQuery,
        { limit: 8, budget: "mid" },
      );

      const evidence = recalled.results.map((item, index) => ({
        rank: index + 1,
        text: item.text,
        type: item.type,
        score: item.score,
      }));

      const evidenceBlock = evidence.length
        ? evidence
            .map((item) => `[Memory ${item.rank}] ${item.text}`)
            .join("\n\n")
        : "No relevant memories were recalled.";

      const reflection = await hindsight.reflect(
        org.hindsight_bank_id || DECISIONDNA_BANK_ID,
        `
You are DecisionDNA's Decision Drift scanner.

Assess this historical organizational decision using ONLY the decision record and recalled organizational evidence below.

Decision ID: ${decision.decision_key}
Title: ${decision.title}
Decision: ${decision.decision}
Original rationale: ${decision.rationale || "not recorded"}
Decision date: ${decision.decision_date}

Recalled evidence:
${evidenceBlock}

Classify the decision into exactly one status:
- STILL_VALID: the original rationale still holds and later evidence does not materially weaken it.
- REVIEW_SUGGESTED: an assumption, constraint, or operating condition materially changed and a human should re-evaluate the decision.
- SUPERSEDED: a later explicit organizational decision replaced this one.
- INSUFFICIENT_EVIDENCE: there is not enough remembered history to make a grounded assessment.

Do not recommend an autonomous architecture change. DecisionDNA surfaces review candidates for humans.

Return exactly this format:
STATUS: <one allowed status>
SUMMARY: <one concise sentence explaining why>
`.trim(),
        { budget: "mid" },
      );

      const text = reflection.text || "";
      results.push({
        decisionId: decision.id,
        decisionKey: decision.decision_key,
        title: decision.title,
        currentDatabaseStatus: decision.status,
        scanStatus: parseStatus(text),
        summary: parseSummary(text),
        evidenceCount: evidence.length,
        evidence,
      });
    }

    const counts = {
      STILL_VALID: results.filter((item) => item.scanStatus === "STILL_VALID").length,
      REVIEW_SUGGESTED: results.filter(
        (item) => item.scanStatus === "REVIEW_SUGGESTED",
      ).length,
      SUPERSEDED: results.filter((item) => item.scanStatus === "SUPERSEDED").length,
      INSUFFICIENT_EVIDENCE: results.filter(
        (item) => item.scanStatus === "INSUFFICIENT_EVIDENCE",
      ).length,
    };

    return NextResponse.json({
      ok: true,
      bankId: org.hindsight_bank_id || DECISIONDNA_BANK_ID,
      scanned: results.length,
      counts,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
