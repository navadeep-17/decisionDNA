import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";

export const runtime = "nodejs";

type Classification =
  | "TRUE_CONTRADICTION"
  | "DECISION_EVOLUTION"
  | "STALE_ASSUMPTION"
  | "RESOLVED";

type Severity = "HIGH" | "MEDIUM" | "LOW";

type EvidenceItem = {
  rank: number;
  text: string;
  type?: string;
  score?: number;
};

const CLASSIFICATIONS: Classification[] = [
  "TRUE_CONTRADICTION",
  "DECISION_EVOLUTION",
  "STALE_ASSUMPTION",
  "RESOLVED",
];

const SEVERITIES: Severity[] = ["HIGH", "MEDIUM", "LOW"];

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

function parseConflicts(text: string, evidence: EvidenceItem[]) {
  return text
    .split("CONFLICT_START")
    .slice(1)
    .map((block) => block.split("CONFLICT_END")[0]?.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((block) => {
      const rawClassification = readField(block, "CLASSIFICATION").toUpperCase();
      const classification: Classification = CLASSIFICATIONS.includes(
        rawClassification as Classification,
      )
        ? (rawClassification as Classification)
        : "STALE_ASSUMPTION";

      const rawSeverity = readField(block, "SEVERITY").toUpperCase();
      const severity: Severity = SEVERITIES.includes(rawSeverity as Severity)
        ? (rawSeverity as Severity)
        : "LOW";

      const claimAEvidenceRanks = parseEvidenceRanks(
        readField(block, "CLAIM_A_EVIDENCE"),
      );
      const claimBEvidenceRanks = parseEvidenceRanks(
        readField(block, "CLAIM_B_EVIDENCE"),
      );

      return {
        title: readField(block, "TITLE") || "Potential memory conflict",
        classification,
        severity,
        claimA: readField(block, "CLAIM_A") || "Earlier organizational claim",
        claimAEvidenceRanks,
        claimAEvidence: evidence.filter((item) =>
          claimAEvidenceRanks.includes(item.rank),
        ),
        claimB: readField(block, "CLAIM_B") || "Later organizational claim",
        claimBEvidenceRanks,
        claimBEvidence: evidence.filter((item) =>
          claimBEvidenceRanks.includes(item.rank),
        ),
        explanation:
          readField(block, "EXPLANATION") ||
          "DecisionDNA found memories that require contextual interpretation.",
        currentInterpretation:
          readField(block, "CURRENT_INTERPRETATION") ||
          "A human should verify which statement applies to the current context.",
        humanAction:
          readField(block, "HUMAN_ACTION") ||
          "Review the linked evidence before relying on either memory.",
      };
    });
}

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const hindsight = getHindsightClient();
    const memoryList = await hindsight.listMemories(DECISIONDNA_BANK_ID, {
      limit: 5,
      offset: 0,
    });

    if (memoryList.total === 0) {
      return NextResponse.json(
        { ok: false, error: "The active Hindsight bank has no memories yet." },
        { status: 409 },
      );
    }

    const recalled = await hindsight.recall(
      DECISIONDNA_BANK_ID,
      `
Inspect NovaPay's organizational memory for statements that appear to disagree, have become stale, or were explicitly superseded over time.

Prioritize evidence about:
- DEC-017 and DEC-021,
- Redis suitability for checkout sessions,
- operational burden and staffing constraints,
- INC-142 and session reliability,
- PostgreSQL outcomes,
- managed Redis Cloud adoption and later successful traffic tests,
- claims that were true in one time period but not another.

Retrieve both sides of any apparent conflict. Prefer concrete decisions, incidents, constraints, and outcomes. Do not assume that a later change automatically means the earlier memory was wrong.
`.trim(),
      { limit: 18, budget: "high" },
    );

    const evidence: EvidenceItem[] = recalled.results.map((item, index) => ({
      rank: index + 1,
      text: item.text,
      type: item.type,
      score: item.score,
    }));

    if (!evidence.length) {
      return NextResponse.json({
        ok: true,
        bankId: DECISIONDNA_BANK_ID,
        memoryTotal: memoryList.total,
        summary: "No potentially conflicting memories were recalled.",
        counts: {
          TRUE_CONTRADICTION: 0,
          DECISION_EVOLUTION: 0,
          STALE_ASSUMPTION: 0,
          RESOLVED: 0,
        },
        conflicts: [],
        evidenceCount: 0,
        evidence: [],
      });
    }

    const evidenceBlock = evidence
      .map((item) => `[Memory ${item.rank}] ${item.text}`)
      .join("\n\n");

    const reflection = await hindsight.reflect(
      DECISIONDNA_BANK_ID,
      `
You are DecisionDNA's Contradiction Radar.

Your job is to detect apparent conflicts in organizational memory WITHOUT treating every historical change as bad data.

Recalled memories:
${evidenceBlock}

Classify each detected case as exactly one of:
- TRUE_CONTRADICTION: two memories make incompatible claims about the same thing in the same applicable context, and the evidence does not resolve which is correct.
- DECISION_EVOLUTION: the organization intentionally changed or superseded an earlier decision. Both memories can be historically correct.
- STALE_ASSUMPTION: an old assumption was reasonable when recorded but later evidence or capability changes make it outdated for current decisions.
- RESOLVED: an apparent contradiction existed but later evidence or a formal decision clearly resolved it.

Severity rules:
- HIGH: relying on the wrong interpretation could materially affect a current architecture, reliability, security, or product decision.
- MEDIUM: the mismatch matters but is unlikely to cause immediate material harm.
- LOW: mostly historical clarification or minor ambiguity.

Strict rules:
- Only create a case when at least TWO distinct memories support the two sides.
- Do not label normal temporal evolution as TRUE_CONTRADICTION.
- Separate historical truth from current applicability.
- Do not autonomously choose technologies or rewrite memories.
- The current interpretation must explain which statement applies now, if the evidence supports it.

First return exactly one line:
RADAR_SUMMARY: <one concise sentence describing memory consistency in NovaPay>

Then return up to FOUR cases using exactly this format:
CONFLICT_START
TITLE: <short title>
CLASSIFICATION: <TRUE_CONTRADICTION | DECISION_EVOLUTION | STALE_ASSUMPTION | RESOLVED>
SEVERITY: <HIGH | MEDIUM | LOW>
CLAIM_A: <first remembered claim>
CLAIM_A_EVIDENCE: <comma-separated memory numbers>
CLAIM_B: <second remembered claim>
CLAIM_B_EVIDENCE: <comma-separated memory numbers>
EXPLANATION: <why these appear to conflict and how time/context changes the interpretation>
CURRENT_INTERPRETATION: <what the evidence currently supports, or why it remains unresolved>
HUMAN_ACTION: <what a human should verify or review>
CONFLICT_END
`.trim(),
      { budget: "high" },
    );

    const text = reflection.text || "";
    const conflicts = parseConflicts(text, evidence);

    const counts = {
      TRUE_CONTRADICTION: conflicts.filter(
        (item) => item.classification === "TRUE_CONTRADICTION",
      ).length,
      DECISION_EVOLUTION: conflicts.filter(
        (item) => item.classification === "DECISION_EVOLUTION",
      ).length,
      STALE_ASSUMPTION: conflicts.filter(
        (item) => item.classification === "STALE_ASSUMPTION",
      ).length,
      RESOLVED: conflicts.filter((item) => item.classification === "RESOLVED")
        .length,
    };

    return NextResponse.json({
      ok: true,
      bankId: DECISIONDNA_BANK_ID,
      memoryTotal: memoryList.total,
      summary:
        readField(text, "RADAR_SUMMARY") ||
        "DecisionDNA checked organizational memory for conflicts, superseded decisions, and stale assumptions.",
      counts,
      conflicts,
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
