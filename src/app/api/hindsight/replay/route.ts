import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";

export const runtime = "nodejs";

type AssumptionStatus = "ACTIVE" | "WEAKENED" | "INVALIDATED" | "UNKNOWN";

type EvidenceItem = {
  rank: number;
  text: string;
  type?: string;
  score?: number;
};

type EventRow = {
  external_id: string | null;
  event_type: string;
  title: string;
  content: string;
  event_date: string;
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

function parseAssumptions(text: string, evidence: EvidenceItem[]) {
  return text
    .split("ASSUMPTION_START")
    .slice(1)
    .map((block) => block.split("ASSUMPTION_END")[0]?.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((block) => {
      const rawStatus = readField(block, "STATUS").toUpperCase();
      const status: AssumptionStatus =
        rawStatus === "ACTIVE" ||
        rawStatus === "WEAKENED" ||
        rawStatus === "INVALIDATED" ||
        rawStatus === "UNKNOWN"
          ? rawStatus
          : "UNKNOWN";
      const evidenceRanks = parseEvidenceRanks(readField(block, "EVIDENCE"));

      return {
        assumption: readField(block, "ASSUMPTION") || "Unspecified assumption",
        status,
        then: readField(block, "THEN") || "Not enough historical detail.",
        now: readField(block, "NOW") || "No material current evidence identified.",
        delta: readField(block, "DELTA") || "No clear change identified.",
        evidenceRanks,
        evidence: evidence.filter((item) => evidenceRanks.includes(item.rank)),
      };
    });
}

function eventText(event: EventRow) {
  return `${event.external_id ? `${event.external_id} · ` : ""}${event.title} (${event.event_date})\n${event.content}`;
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
        "id, organization_id, project_id, decision_key, title, summary, decision, rationale, decision_date, status",
      )
      .eq("decision_key", decisionKey)
      .single();

    if (decisionError || !decision) {
      throw decisionError || new Error(`Decision ${decisionKey} not found`);
    }

    let eventsQuery = supabase
      .from("events")
      .select("external_id, event_type, title, content, event_date")
      .eq("organization_id", decision.organization_id)
      .order("event_date", { ascending: true });

    if (decision.project_id) {
      eventsQuery = eventsQuery.eq("project_id", decision.project_id);
    }

    const { data: events, error: eventsError } = await eventsQuery;
    if (eventsError) throw eventsError;

    const eventRows = (events || []) as EventRow[];
    const decisionTime = new Date(decision.decision_date).getTime();
    const thenEvents = eventRows.filter(
      (event) => new Date(event.event_date).getTime() <= decisionTime,
    );
    const laterEvents = eventRows.filter(
      (event) => new Date(event.event_date).getTime() > decisionTime,
    );

    const hindsight = getHindsightClient();
    const recalled = await hindsight.recall(
      DECISIONDNA_BANK_ID,
      `
Reconstruct the organizational context around ${decision.decision_key}: ${decision.title}, then compare it with what NovaPay learned later.

Decision date: ${decision.decision_date}
Decision: ${decision.decision}
Original rationale: ${decision.rationale || "not recorded"}

Find memories about:
- evidence and constraints known when this decision was made,
- assumptions embedded in the original rationale,
- incidents or outcomes that later validated or weakened those assumptions,
- capability, staffing, operational, or technical changes after the decision,
- explicit conditions under which the decision could be reconsidered.

Prioritize temporally useful evidence and concrete causal links.
`.trim(),
      { limit: 14, budget: "high" },
    );

    const evidence: EvidenceItem[] = recalled.results.map((item, index) => ({
      rank: index + 1,
      text: item.text,
      type: item.type,
      score: item.score,
    }));

    const thenBlock = thenEvents.length
      ? thenEvents.map((event, index) => `[Then ${index + 1}] ${eventText(event)}`).join("\n\n")
      : "No structured pre-decision events were found.";
    const laterBlock = laterEvents.length
      ? laterEvents.map((event, index) => `[Later ${index + 1}] ${eventText(event)}`).join("\n\n")
      : "No structured post-decision events were found.";
    const memoryBlock = evidence.length
      ? evidence.map((item) => `[Memory ${item.rank}] ${item.text}`).join("\n\n")
      : "No related Hindsight memories were recalled.";

    const reflection = await hindsight.reflect(
      DECISIONDNA_BANK_ID,
      `
You are DecisionDNA's temporal Decision Replay engine.

Your job is to explain how the information available to NovaPay changed between the moment a decision was made and today.

Decision:
ID: ${decision.decision_key}
Title: ${decision.title}
Date: ${decision.decision_date}
Decision: ${decision.decision}
Original rationale: ${decision.rationale || "not recorded"}

STRUCTURED EVENTS KNOWN BY THE DECISION DATE:
${thenBlock}

STRUCTURED EVENTS THAT HAPPENED AFTER THE DECISION:
${laterBlock}

RELATED HINDSIGHT MEMORIES:
${memoryBlock}

Rules:
- Treat pre-decision and post-decision evidence separately.
- Do not rewrite history using facts learned later.
- Identify assumptions that were reasonable THEN but may differ NOW.
- Mark assumptions as ACTIVE, WEAKENED, INVALIDATED, or UNKNOWN.
- Do not automatically recommend a technology change; keep the final action human-controlled.
- Ground assumption changes in the supplied evidence.

Return these top-level lines:
THEN_SUMMARY: <what the organization reasonably knew when the decision was made>
NOW_SUMMARY: <what the organization knows now that was not available then>
DECISION_DELTA: <the most important change in decision context>
HUMAN_ACTION: <the most appropriate human review action>

Then return up to FOUR assumption blocks:
ASSUMPTION_START
ASSUMPTION: <original assumption or constraint>
STATUS: <ACTIVE | WEAKENED | INVALIDATED | UNKNOWN>
THEN: <why it was reasonable at decision time>
NOW: <what later evidence says>
DELTA: <what changed, if anything>
EVIDENCE: <comma-separated Hindsight memory ranks>
ASSUMPTION_END
`.trim(),
      { budget: "high" },
    );

    const text = reflection.text || "";

    return NextResponse.json({
      ok: true,
      decision: {
        key: decision.decision_key,
        title: decision.title,
        date: decision.decision_date,
        rationale: decision.rationale,
        status: decision.status,
      },
      then: {
        eventCount: thenEvents.length,
        events: thenEvents,
        summary: readField(text, "THEN_SUMMARY") || "Historical context reconstructed from available evidence.",
      },
      now: {
        eventCount: laterEvents.length,
        events: laterEvents,
        summary: readField(text, "NOW_SUMMARY") || "Current context includes evidence learned after the original decision.",
      },
      decisionDelta:
        readField(text, "DECISION_DELTA") ||
        "No material change in decision context was identified.",
      humanAction:
        readField(text, "HUMAN_ACTION") ||
        "Keep the decision under human review when assumptions materially change.",
      assumptions: parseAssumptions(text, evidence),
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
