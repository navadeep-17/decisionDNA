import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";

export const runtime = "nodejs";

type Priority = "HIGH" | "MEDIUM" | "LOW";
type Readiness = "READY_FOR_HUMAN_REVIEW" | "PARTIAL_EVIDENCE" | "NOT_READY";

type EvidenceItem = {
  rank: number;
  text: string;
  type?: string;
  score?: number;
};

type KnownFact = {
  statement: string;
  evidenceRanks: number[];
  evidence: EvidenceItem[];
};

type Gap = {
  category: string;
  priority: Priority;
  question: string;
  whyItMatters: string;
  howToClose: string;
  relatedEvidenceRanks: number[];
  relatedEvidence: EvidenceItem[];
};

type Conflict = {
  issue: string;
  whyUnresolved: string;
  evidenceRanks: number[];
  evidence: EvidenceItem[];
};

function readField(text: string, field: string) {
  const regex = new RegExp(`^${field}:\\s*(.+)$`, "im");
  return text.match(regex)?.[1]?.trim() || "";
}

function parseRanks(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => Number(item.replace(/[^0-9]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function linkedEvidence(ranks: number[], evidence: EvidenceItem[]) {
  return evidence.filter((item) => ranks.includes(item.rank));
}

function parseKnown(text: string, evidence: EvidenceItem[]): KnownFact[] {
  return text
    .split("KNOWN_START")
    .slice(1)
    .map((block) => block.split("KNOWN_END")[0]?.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((block) => {
      const evidenceRanks = parseRanks(readField(block, "EVIDENCE"));
      return {
        statement: readField(block, "STATEMENT") || "Known organizational evidence",
        evidenceRanks,
        evidence: linkedEvidence(evidenceRanks, evidence),
      };
    });
}

function parseGaps(text: string, evidence: EvidenceItem[]): Gap[] {
  return text
    .split("GAP_START")
    .slice(1)
    .map((block) => block.split("GAP_END")[0]?.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((block) => {
      const rawPriority = readField(block, "PRIORITY").toUpperCase();
      const priority: Priority =
        rawPriority === "HIGH" || rawPriority === "MEDIUM" || rawPriority === "LOW"
          ? rawPriority
          : "MEDIUM";
      const relatedEvidenceRanks = parseRanks(readField(block, "RELATED_EVIDENCE"));
      return {
        category: readField(block, "CATEGORY") || "Decision evidence",
        priority,
        question: readField(block, "QUESTION") || "What evidence is still missing?",
        whyItMatters: readField(block, "WHY_IT_MATTERS") || "This evidence could materially change the decision.",
        howToClose: readField(block, "HOW_TO_CLOSE") || "Collect targeted evidence before approval.",
        relatedEvidenceRanks,
        relatedEvidence: linkedEvidence(relatedEvidenceRanks, evidence),
      };
    });
}

function parseConflicts(text: string, evidence: EvidenceItem[]): Conflict[] {
  return text
    .split("CONFLICT_START")
    .slice(1)
    .map((block) => block.split("CONFLICT_END")[0]?.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((block) => {
      const evidenceRanks = parseRanks(readField(block, "EVIDENCE"));
      return {
        issue: readField(block, "ISSUE") || "Conflicting evidence",
        whyUnresolved: readField(block, "WHY_UNRESOLVED") || "The current memory does not resolve this conflict.",
        evidenceRanks,
        evidence: linkedEvidence(evidenceRanks, evidence),
      };
    });
}

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user || !auth.token) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { proposal?: string };
    const proposal = body.proposal?.trim();
    if (!proposal) {
      return NextResponse.json({ ok: false, error: "proposal is required" }, { status: 400 });
    }

    const supabase = createSupabaseUserClient(auth.token);
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, hindsight_bank_id")
      .eq("slug", "novapay")
      .single();

    if (orgError || !org) throw orgError || new Error("NovaPay organization not found");

    const hindsight = getHindsightClient();
    const bankId = org.hindsight_bank_id || DECISIONDNA_BANK_ID;

    const recalled = await hindsight.recall(
      bankId,
      `
NovaPay is considering this proposal:
${proposal}

Retrieve organizational memory that helps evaluate decision readiness before approval.

Find concrete evidence about:
- prior attempts or related decisions,
- reliability and failure modes,
- scale and performance evidence,
- operational ownership and staffing constraints,
- cost or resource tradeoffs when available,
- rollback/recovery evidence,
- outcomes from previous experiments,
- contradictions or unresolved evidence.

Prefer remembered evidence over inference. Missing evidence should remain missing rather than being invented.
`.trim(),
      { limit: 18, budget: "high" },
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
You are DecisionDNA's Knowledge Gap Radar.

Your role is to determine whether the organization has enough remembered evidence to put a proposal in front of a human decision-maker, and to identify exactly what is still unknown.

PROPOSAL:
${proposal}

RECALLED ORGANIZATIONAL MEMORY:
${memoryBlock}

Important rules:
- Never invent evidence that is not in the recalled memory.
- A missing fact is a gap, not permission to assume the favorable answer.
- Separate what NovaPay KNOWS from what it still NEEDS TO KNOW.
- Surface unresolved conflicts separately from simple missing evidence.
- Suggested next steps should be concrete evidence-gathering actions, not autonomous architecture changes.
- READY_FOR_HUMAN_REVIEW means the main material risks have evidence; it does not mean the proposal should be approved.

Return these top-level lines:
READINESS: <READY_FOR_HUMAN_REVIEW | PARTIAL_EVIDENCE | NOT_READY>
SUMMARY: <one concise explanation of current decision readiness>
NEXT_ACTION: <single highest-value evidence-gathering action>

Then return up to SIX grounded known facts:
KNOWN_START
STATEMENT: <fact the organization already knows>
EVIDENCE: <comma-separated memory ranks>
KNOWN_END

Then return up to SIX material evidence gaps:
GAP_START
CATEGORY: <short category such as Reliability, Cost, Rollback, Operations, Scale, Security, Ownership, Outcome>
PRIORITY: <HIGH | MEDIUM | LOW>
QUESTION: <specific unanswered question>
WHY_IT_MATTERS: <why this could change the decision>
HOW_TO_CLOSE: <specific test, measurement, document, owner confirmation, or experiment needed>
RELATED_EVIDENCE: <comma-separated memory ranks that make this gap relevant, or NONE>
GAP_END

If recalled memories genuinely conflict, return up to FOUR blocks:
CONFLICT_START
ISSUE: <what evidence currently disagrees about>
WHY_UNRESOLVED: <why current memory cannot settle it>
EVIDENCE: <comma-separated memory ranks>
CONFLICT_END
`.trim(),
      { budget: "high" },
    );

    const text = reflection.text || "";
    const readinessRaw = readField(text, "READINESS").toUpperCase();
    const readiness: Readiness =
      readinessRaw === "READY_FOR_HUMAN_REVIEW" ||
      readinessRaw === "PARTIAL_EVIDENCE" ||
      readinessRaw === "NOT_READY"
        ? readinessRaw
        : "PARTIAL_EVIDENCE";

    const known = parseKnown(text, evidence);
    const gaps = parseGaps(text, evidence);
    const conflicts = parseConflicts(text, evidence);

    return NextResponse.json({
      ok: true,
      bankId,
      proposal,
      readiness,
      summary: readField(text, "SUMMARY") || "DecisionDNA compared the proposal against available organizational memory.",
      nextAction: readField(text, "NEXT_ACTION") || "Collect the highest-priority missing evidence before human approval.",
      known,
      gaps,
      conflicts,
      counts: {
        known: known.length,
        gaps: gaps.length,
        highPriorityGaps: gaps.filter((gap) => gap.priority === "HIGH").length,
        conflicts: conflicts.length,
      },
      evidenceCount: evidence.length,
      evidence,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
