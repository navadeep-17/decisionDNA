import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";

export const runtime = "nodejs";

type EvidenceItem = {
  rank: number;
  text: string;
  type?: string;
  score?: number;
};

function readField(text: string, field: string) {
  const regex = new RegExp(`^${field}:\\s*(.+)$`, "im");
  return text.match(regex)?.[1]?.trim() || "";
}

function readScore(text: string, field: string, fallback = 50) {
  const raw = Number(readField(text, field).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function trustBand(score: number) {
  if (score >= 75) return "STRONG";
  if (score >= 55) return "MODERATE";
  return "FRAGILE";
}

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user || !auth.token) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { decisionKey?: string };
    const decisionKey = body.decisionKey?.trim();
    if (!decisionKey) {
      return NextResponse.json(
        { ok: false, error: "decisionKey is required" },
        { status: 400 },
      );
    }

    const supabase = createSupabaseUserClient(auth.token);
    const { data: decision, error: decisionError } = await supabase
      .from("decisions")
      .select(
        "id, organization_id, project_id, decision_key, title, decision, rationale, decision_date, status",
      )
      .eq("decision_key", decisionKey)
      .single();

    if (decisionError || !decision) {
      throw decisionError || new Error(`Decision ${decisionKey} not found`);
    }

    let eventQuery = supabase
      .from("events")
      .select("event_type, title, content, event_date")
      .eq("organization_id", decision.organization_id)
      .order("event_date", { ascending: false })
      .limit(20);

    if (decision.project_id) {
      eventQuery = eventQuery.eq("project_id", decision.project_id);
    }

    const { data: events, error: eventsError } = await eventQuery;
    if (eventsError) throw eventsError;

    const latestEventDate = events?.[0]?.event_date || decision.decision_date;

    const hindsight = getHindsightClient();
    const recalled = await hindsight.recall(
      DECISIONDNA_BANK_ID,
      `
Assess the CURRENT trustworthiness of the rationale behind ${decision.decision_key}: ${decision.title}.

Decision: ${decision.decision}
Original rationale: ${decision.rationale || "not recorded"}
Decision date: ${decision.decision_date}
Current database status: ${decision.status}

Retrieve the strongest organizational evidence about:
- facts that support the rationale,
- later outcomes that validated the decision,
- later evidence that contradicts or weakens the rationale,
- changed assumptions or constraints,
- recent evidence that should influence confidence today.

This is a trust assessment of the CURRENT rationale, not a prediction and not an autonomous architecture recommendation.
`.trim(),
      { limit: 14, budget: "high" },
    );

    const evidence: EvidenceItem[] = recalled.results.map((item, index) => ({
      rank: index + 1,
      text: item.text,
      type: item.type,
      score: item.score,
    }));

    const evidenceBlock = evidence.length
      ? evidence.map((item) => `[Memory ${item.rank}] ${item.text}`).join("\n\n")
      : "No relevant Hindsight memories were recalled.";

    const reflection = await hindsight.reflect(
      DECISIONDNA_BANK_ID,
      `
You are DecisionDNA's evidence-quality analyst.

Score how trustworthy the CURRENT rationale remains for this decision, using only the decision record and organizational evidence below.

Decision ID: ${decision.decision_key}
Title: ${decision.title}
Decision: ${decision.decision}
Original rationale: ${decision.rationale || "not recorded"}
Decision date: ${decision.decision_date}
Latest structured project evidence date: ${latestEventDate}

Organizational evidence:
${evidenceBlock}

Return FOUR independent 0-100 dimensions:
- EVIDENCE_SUPPORT: how strongly the remembered evidence supports the rationale today.
- OUTCOME_VALIDATION: how strongly observed outcomes validated the rationale or decision.
- CONTRADICTION_PRESSURE: how much credible later evidence conflicts with, weakens, or makes the rationale stale. Higher means MORE conflict.
- FRESHNESS: how current and temporally relevant the supporting evidence is.

Rules:
- Do not inflate confidence because there are many memories; quality matters more than count.
- A historically sensible rationale can still have low current trust if assumptions changed.
- Distinguish true contradiction from normal decision evolution.
- Do not recommend an automatic technology switch.

Return exactly these lines:
EVIDENCE_SUPPORT: <0-100>
EVIDENCE_SUPPORT_REASON: <one concise sentence>
OUTCOME_VALIDATION: <0-100>
OUTCOME_VALIDATION_REASON: <one concise sentence>
CONTRADICTION_PRESSURE: <0-100>
CONTRADICTION_PRESSURE_REASON: <one concise sentence>
FRESHNESS: <0-100>
FRESHNESS_REASON: <one concise sentence>
SUMMARY: <one concise sentence describing current rationale trust>
HUMAN_ACTION: <one concise human review action>
`.trim(),
      { budget: "high" },
    );

    const text = reflection.text || "";
    const evidenceSupport = readScore(text, "EVIDENCE_SUPPORT");
    const outcomeValidation = readScore(text, "OUTCOME_VALIDATION");
    const contradictionPressure = readScore(text, "CONTRADICTION_PRESSURE");
    const freshness = readScore(text, "FRESHNESS");
    const consistency = 100 - contradictionPressure;

    const trustScore = Math.round(
      evidenceSupport * 0.3 +
        outcomeValidation * 0.3 +
        consistency * 0.25 +
        freshness * 0.15,
    );

    return NextResponse.json({
      ok: true,
      decision: {
        key: decision.decision_key,
        title: decision.title,
        date: decision.decision_date,
        status: decision.status,
      },
      trustScore,
      band: trustBand(trustScore),
      formula: {
        evidenceSupportWeight: 0.3,
        outcomeValidationWeight: 0.3,
        consistencyWeight: 0.25,
        freshnessWeight: 0.15,
      },
      dimensions: {
        evidenceSupport: {
          score: evidenceSupport,
          reason: readField(text, "EVIDENCE_SUPPORT_REASON"),
        },
        outcomeValidation: {
          score: outcomeValidation,
          reason: readField(text, "OUTCOME_VALIDATION_REASON"),
        },
        contradictionPressure: {
          score: contradictionPressure,
          reason: readField(text, "CONTRADICTION_PRESSURE_REASON"),
        },
        consistency: {
          score: consistency,
          reason: "Derived as 100 minus contradiction pressure.",
        },
        freshness: {
          score: freshness,
          reason: readField(text, "FRESHNESS_REASON"),
        },
      },
      summary:
        readField(text, "SUMMARY") ||
        "Decision trust was calculated from evidence support, outcomes, consistency, and freshness.",
      humanAction:
        readField(text, "HUMAN_ACTION") ||
        "Use the score as a review signal, not as an autonomous decision.",
      latestEventDate,
      evidenceCount: evidence.length,
      evidence,
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
