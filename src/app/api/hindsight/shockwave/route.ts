import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";

export const runtime = "nodejs";

type ImpactType = "DECISION" | "ASSUMPTION" | "LESSON";
type Severity = "HIGH" | "MEDIUM" | "LOW";

type EvidenceItem = {
  rank: number;
  text: string;
  type?: string;
  score?: number;
};

type ImpactNode = {
  id: string;
  type: ImpactType;
  label: string;
  severity: Severity;
  relationship: string;
  why: string;
  evidenceRanks: number[];
  evidence: EvidenceItem[];
};

function readField(text: string, field: string) {
  const regex = new RegExp(`^${field}:\\s*(.+)$`, "im");
  return text.match(regex)?.[1]?.trim() || "";
}

function parseEvidenceRanks(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => Number(item.replace(/[^0-9]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function parseImpacts(text: string, evidence: EvidenceItem[]): ImpactNode[] {
  return text
    .split("IMPACT_START")
    .slice(1)
    .map((block) => block.split("IMPACT_END")[0]?.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((block, index) => {
      const rawType = readField(block, "TYPE").toUpperCase();
      const type: ImpactType =
        rawType === "DECISION" || rawType === "ASSUMPTION" || rawType === "LESSON"
          ? rawType
          : "LESSON";

      const rawSeverity = readField(block, "SEVERITY").toUpperCase();
      const severity: Severity =
        rawSeverity === "HIGH" || rawSeverity === "MEDIUM" || rawSeverity === "LOW"
          ? rawSeverity
          : "LOW";

      const evidenceRanks = parseEvidenceRanks(readField(block, "EVIDENCE"));

      return {
        id: `impact-${index + 1}`,
        type,
        label: readField(block, "LABEL") || "Organizational knowledge",
        severity,
        relationship: readField(block, "RELATIONSHIP") || "related to",
        why: readField(block, "WHY") || "Related organizational context may have changed.",
        evidenceRanks,
        evidence: evidence.filter((item) => evidenceRanks.includes(item.rank)),
      };
    });
}

function severityWeight(severity: Severity) {
  if (severity === "HIGH") return 3;
  if (severity === "MEDIUM") return 2;
  return 1;
}

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user || !auth.token) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { eventId?: string };
    const supabase = createSupabaseUserClient(auth.token);

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, hindsight_bank_id")
      .eq("slug", "novapay")
      .single();

    if (orgError || !org) {
      throw orgError || new Error("NovaPay organization not found");
    }

    let eventQuery = supabase
      .from("events")
      .select("id, external_id, event_type, title, content, event_date, project_id")
      .eq("organization_id", org.id);

    if (body.eventId) eventQuery = eventQuery.eq("id", body.eventId);
    else eventQuery = eventQuery.order("event_date", { ascending: false }).limit(1);

    const { data: eventRows, error: eventError } = await eventQuery;
    if (eventError) throw eventError;

    const event = eventRows?.[0];
    if (!event) {
      return NextResponse.json(
        { ok: false, error: "No organizational event was found to analyze." },
        { status: 404 },
      );
    }

    const [decisionsResult, constraintsResult] = await Promise.all([
      supabase
        .from("decisions")
        .select("decision_key, title, decision, rationale, status, decision_date")
        .eq("organization_id", org.id)
        .order("decision_date", { ascending: true }),
      supabase
        .from("decision_constraints")
        .select("constraint_text, status, decisions!inner(decision_key, organization_id)")
        .eq("decisions.organization_id", org.id),
    ]);

    if (decisionsResult.error) throw decisionsResult.error;
    if (constraintsResult.error) throw constraintsResult.error;

    const decisionBlock = (decisionsResult.data || [])
      .map(
        (decision) =>
          `${decision.decision_key} · ${decision.title}\nDecision: ${decision.decision}\nRationale: ${decision.rationale || "not recorded"}\nStatus: ${decision.status}\nDate: ${decision.decision_date}`,
      )
      .join("\n\n");

    const constraintBlock = (constraintsResult.data || [])
      .map((constraint: any) => {
        const linked = Array.isArray(constraint.decisions)
          ? constraint.decisions[0]
          : constraint.decisions;
        return `${linked?.decision_key || "Decision"}: ${constraint.constraint_text} [${constraint.status}]`;
      })
      .join("\n");

    const hindsight = getHindsightClient();
    const bankId = org.hindsight_bank_id || DECISIONDNA_BANK_ID;

    const recalled = await hindsight.recall(
      bankId,
      `
A new NovaPay organizational event may have downstream effects on historical decisions and organizational learning.

NEW EVENT:
${event.external_id ? `${event.external_id} · ` : ""}${event.title}
Type: ${event.event_type}
Date: ${event.event_date}
Content: ${event.content}

Find memories that help determine:
- which historical decisions this event strengthens, weakens, or makes worth reviewing,
- which assumptions or constraints are changed by the new evidence,
- which organizational lessons should be updated,
- whether the effect is direct or only contextual.

Prioritize causal and temporal links. Do not invent impact where evidence is weak.
`.trim(),
      { limit: 16, budget: "high" },
    );

    const evidence: EvidenceItem[] = recalled.results.map((item, index) => ({
      rank: index + 1,
      text: item.text,
      type: item.type,
      score: item.score,
    }));

    const memoryBlock = evidence.length
      ? evidence.map((item) => `[Memory ${item.rank}] ${item.text}`).join("\n\n")
      : "No related Hindsight memories were recalled.";

    const reflection = await hindsight.reflect(
      bankId,
      `
You are DecisionDNA's Decision Shockwave engine.

A new organizational memory has arrived. Map how this one event propagates through the organization's existing decision knowledge.

NEW EVENT:
${event.external_id ? `${event.external_id} · ` : ""}${event.title}
${event.content}
Date: ${event.event_date}

TRACKED DECISIONS:
${decisionBlock || "No tracked decisions."}

TRACKED ASSUMPTIONS / CONSTRAINTS:
${constraintBlock || "No structured constraints."}

RELATED HINDSIGHT MEMORIES:
${memoryBlock}

Create only impacts that are grounded in the supplied history.
Use these node types:
- DECISION: a tracked historical decision whose review context changed.
- ASSUMPTION: a constraint or premise that became stronger, weaker, or obsolete.
- LESSON: a durable organizational learning that should now be interpreted differently.

Severity:
- HIGH: materially changes whether a decision/assumption deserves human review.
- MEDIUM: meaningfully changes context but does not by itself alter decision status.
- LOW: useful contextual learning with limited immediate decision impact.

Do not autonomously change any decision.

Return these top-level lines:
SHOCKWAVE_SUMMARY: <one sentence describing the propagation effect>
HUMAN_ACTION: <the highest-value human review action>

Then return up to EIGHT impacts:
IMPACT_START
TYPE: <DECISION | ASSUMPTION | LESSON>
LABEL: <decision ID/title or concise assumption/lesson>
SEVERITY: <HIGH | MEDIUM | LOW>
RELATIONSHIP: <short edge label such as weakens, validates, invalidates, updates, triggers review of>
WHY: <concise explanation of how the new event affects this node>
EVIDENCE: <comma-separated Hindsight memory ranks>
IMPACT_END
`.trim(),
      { budget: "high" },
    );

    const text = reflection.text || "";
    const impacts = parseImpacts(text, evidence);
    const weighted = impacts.reduce((sum, item) => sum + severityWeight(item.severity), 0);
    const intensity = Math.min(100, Math.round((weighted / Math.max(1, impacts.length * 3)) * 100));

    const counts = {
      decisions: impacts.filter((item) => item.type === "DECISION").length,
      assumptions: impacts.filter((item) => item.type === "ASSUMPTION").length,
      lessons: impacts.filter((item) => item.type === "LESSON").length,
      highSeverity: impacts.filter((item) => item.severity === "HIGH").length,
    };

    return NextResponse.json({
      ok: true,
      event: {
        id: event.id,
        externalId: event.external_id,
        title: event.title,
        type: event.event_type,
        date: event.event_date,
        content: event.content,
      },
      summary:
        readField(text, "SHOCKWAVE_SUMMARY") ||
        "DecisionDNA traced the latest memory through related organizational knowledge.",
      humanAction:
        readField(text, "HUMAN_ACTION") ||
        "Review high-severity downstream impacts before changing any historical decision.",
      intensity,
      counts,
      impacts,
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
