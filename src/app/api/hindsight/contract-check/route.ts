import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";

export const runtime = "nodejs";

type TermType = "assumption" | "success_criterion" | "reversal_condition";
type EvaluationStatus =
  | "HOLDS"
  | "WEAKENED"
  | "INVALIDATED"
  | "VALIDATED"
  | "AT_RISK"
  | "MET"
  | "POSSIBLY_MET"
  | "NOT_MET"
  | "UNKNOWN";

type ContractState =
  | "VALID"
  | "AT_RISK"
  | "PARTIAL_TRIGGER"
  | "REVIEW_TRIGGERED"
  | "INSUFFICIENT_EVIDENCE";

type ContractTerm = {
  id: string;
  term_key: string;
  term_type: TermType;
  term_text: string;
  baseline_status: string;
  sort_order: number;
};

type EvidenceItem = {
  rank: number;
  text: string;
  type?: string;
  score?: number;
};

const ALLOWED_STATUSES: EvaluationStatus[] = [
  "HOLDS",
  "WEAKENED",
  "INVALIDATED",
  "VALIDATED",
  "AT_RISK",
  "MET",
  "POSSIBLY_MET",
  "NOT_MET",
  "UNKNOWN",
];

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

function parseEvaluations(
  text: string,
  terms: ContractTerm[],
  evidence: EvidenceItem[],
) {
  const byKey = new Map(terms.map((term) => [term.term_key, term]));

  return text
    .split("TERM_START")
    .slice(1)
    .map((block) => block.split("TERM_END")[0]?.trim())
    .filter(Boolean)
    .map((block) => {
      const key = readField(block, "KEY");
      const term = byKey.get(key);
      if (!term) return null;

      const rawStatus = readField(block, "STATUS").toUpperCase();
      const status: EvaluationStatus = ALLOWED_STATUSES.includes(
        rawStatus as EvaluationStatus,
      )
        ? (rawStatus as EvaluationStatus)
        : "UNKNOWN";
      const evidenceRanks = parseEvidenceRanks(readField(block, "EVIDENCE"));

      return {
        key: term.term_key,
        type: term.term_type,
        text: term.term_text,
        baselineStatus: term.baseline_status,
        status,
        current:
          readField(block, "CURRENT") ||
          "No sufficiently specific current interpretation was returned.",
        why:
          readField(block, "WHY") ||
          "DecisionDNA could not establish a stronger evidence-backed explanation.",
        evidenceRanks,
        evidence: evidence.filter((item) => evidenceRanks.includes(item.rank)),
      };
    })
    .filter(Boolean);
}

function computeContractState(
  evaluations: Array<{
    type: TermType;
    status: EvaluationStatus;
  }>,
): ContractState {
  if (!evaluations.length || evaluations.every((item) => item.status === "UNKNOWN")) {
    return "INSUFFICIENT_EVIDENCE";
  }

  const reversal = evaluations.filter((item) => item.type === "reversal_condition");
  if (reversal.some((item) => item.status === "MET")) return "REVIEW_TRIGGERED";
  if (reversal.some((item) => item.status === "POSSIBLY_MET")) return "PARTIAL_TRIGGER";

  const assumptions = evaluations.filter((item) => item.type === "assumption");
  const success = evaluations.filter((item) => item.type === "success_criterion");

  if (
    assumptions.some(
      (item) => item.status === "INVALIDATED" || item.status === "WEAKENED",
    ) || success.some((item) => item.status === "AT_RISK")
  ) {
    return "AT_RISK";
  }

  return "VALID";
}

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user || !auth.token) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      decisionKey?: string;
    };
    const decisionKey = body.decisionKey?.trim() || "DEC-021";

    const supabase = createSupabaseUserClient(auth.token);
    const { data: decision, error: decisionError } = await supabase
      .from("decisions")
      .select(
        "id, organization_id, decision_key, title, decision, rationale, status, decision_date",
      )
      .eq("decision_key", decisionKey)
      .single();

    if (decisionError || !decision) {
      throw decisionError || new Error(`Decision ${decisionKey} not found`);
    }

    const [{ data: org, error: orgError }, { data: termRows, error: termsError }] =
      await Promise.all([
        supabase
          .from("organizations")
          .select("hindsight_bank_id")
          .eq("id", decision.organization_id)
          .single(),
        supabase
          .from("decision_contract_terms")
          .select(
            "id, term_key, term_type, term_text, baseline_status, sort_order",
          )
          .eq("decision_id", decision.id)
          .order("sort_order", { ascending: true }),
      ]);

    if (orgError || !org) throw orgError || new Error("Organization not found");
    if (termsError) throw termsError;

    const terms = (termRows || []) as ContractTerm[];
    if (!terms.length) {
      return NextResponse.json(
        {
          ok: false,
          error: `No persisted decision contract exists for ${decisionKey}.`,
        },
        { status: 404 },
      );
    }

    const bankId = org.hindsight_bank_id || DECISIONDNA_BANK_ID;
    const hindsight = getHindsightClient();
    const contractBlock = terms
      .map(
        (term) =>
          `${term.term_key} [${term.term_type.toUpperCase()}] ${term.term_text}`,
      )
      .join("\n");

    const recalled = await hindsight.recall(
      bankId,
      `
Evaluate the current validity of the explicit decision contract for ${decision.decision_key}: ${decision.title}.

Original decision date: ${decision.decision_date}
Decision: ${decision.decision}
Original rationale: ${decision.rationale || "not recorded"}

PERSISTED CONTRACT TERMS:
${contractBlock}

Find organizational memories that show whether each assumption still holds, whether success criteria were validated, and whether any explicit reversal condition has become true.
Prioritize later outcomes, incidents, capability changes, staffing changes, and managed-service changes.
Do not invent a trigger that is not supported by memory.
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
      : "No related memories were recalled.";

    const reflection = await hindsight.reflect(
      bankId,
      `
You are DecisionDNA's Decision Contract evaluator.

The contract below was attached to a historical decision so the organization could define, in advance, what evidence would validate it and what would justify reconsideration.

DECISION:
${decision.decision_key} · ${decision.title}
Date: ${decision.decision_date}
Decision: ${decision.decision}
Rationale: ${decision.rationale || "not recorded"}

CONTRACT TERMS:
${contractBlock}

CURRENT ORGANIZATIONAL MEMORY:
${memoryBlock}

Evaluate every contract term independently.

Allowed statuses by term type:
- assumption: HOLDS, WEAKENED, INVALIDATED, UNKNOWN
- success_criterion: VALIDATED, AT_RISK, UNKNOWN
- reversal_condition: MET, POSSIBLY_MET, NOT_MET, UNKNOWN

Rules:
- Reversal conditions must be interpreted literally and conservatively.
- A related event is not automatically enough to mark a reversal condition MET.
- Use POSSIBLY_MET when evidence is suggestive but not an exact match.
- Do not recommend an autonomous architecture switch.
- Keep the output grounded in the supplied memories.

First return:
CONTRACT_SUMMARY: <one concise sentence describing the contract's current health>
HUMAN_ACTION: <the appropriate human review action>

Then return exactly one block for every supplied contract key:
TERM_START
KEY: <exact contract key>
STATUS: <allowed status for that term type>
CURRENT: <what current evidence says about this term>
WHY: <why this status is justified>
EVIDENCE: <comma-separated Hindsight memory ranks>
TERM_END
`.trim(),
      { budget: "high" },
    );

    const text = reflection.text || "";
    const evaluations = parseEvaluations(text, terms, evidence);
    const contractState = computeContractState(
      evaluations as Array<{ type: TermType; status: EvaluationStatus }>,
    );

    const reversalEvaluations = evaluations.filter(
      (item) => item?.type === "reversal_condition",
    );

    return NextResponse.json({
      ok: true,
      bankId,
      decision: {
        key: decision.decision_key,
        title: decision.title,
        date: decision.decision_date,
        decision: decision.decision,
        rationale: decision.rationale,
        status: decision.status,
      },
      contractState,
      summary:
        readField(text, "CONTRACT_SUMMARY") ||
        "DecisionDNA evaluated the original decision contract against current organizational memory.",
      humanAction:
        readField(text, "HUMAN_ACTION") ||
        "Review the decision when an explicit reversal condition is met.",
      termCount: terms.length,
      reversalConditionCount: reversalEvaluations.length,
      triggeredCount: reversalEvaluations.filter((item) => item?.status === "MET")
        .length,
      possibleTriggerCount: reversalEvaluations.filter(
        (item) => item?.status === "POSSIBLY_MET",
      ).length,
      evaluations,
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
