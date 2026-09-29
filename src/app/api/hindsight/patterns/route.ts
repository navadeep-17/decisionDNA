import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";

export const runtime = "nodejs";

type PatternType = "RECURRING" | "EMERGING" | "LESSON";

type EvidenceItem = {
  rank: number;
  text: string;
  type?: string;
  score?: number;
};

type Pattern = {
  name: string;
  type: PatternType;
  signal: string;
  whyItMatters: string;
  watchFor: string;
  evidenceRanks: number[];
  evidence: EvidenceItem[];
};

function readField(block: string, field: string) {
  const regex = new RegExp(`^${field}:\\s*(.+)$`, "im");
  return block.match(regex)?.[1]?.trim() || "";
}

function parseEvidenceRanks(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => Number(item.replace(/[^0-9]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function parsePatterns(text: string, evidence: EvidenceItem[]): Pattern[] {
  const blocks = text
    .split("PATTERN_START")
    .slice(1)
    .map((block) => block.split("PATTERN_END")[0]?.trim())
    .filter(Boolean) as string[];

  return blocks.slice(0, 3).map((block) => {
    const rawType = readField(block, "TYPE").toUpperCase();
    const type: PatternType =
      rawType === "RECURRING" || rawType === "EMERGING" || rawType === "LESSON"
        ? rawType
        : "LESSON";

    const evidenceRanks = parseEvidenceRanks(readField(block, "EVIDENCE"));

    return {
      name: readField(block, "NAME") || "Organizational learning",
      type,
      signal: readField(block, "SIGNAL") || "Pattern found in organizational history.",
      whyItMatters:
        readField(block, "WHY_IT_MATTERS") ||
        "This pattern may affect future technical decisions.",
      watchFor:
        readField(block, "WATCH_FOR") ||
        "Re-check the underlying assumptions when similar conditions appear.",
      evidenceRanks,
      evidence: evidence.filter((item) => evidenceRanks.includes(item.rank)),
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

    const memories = await hindsight.listMemories(DECISIONDNA_BANK_ID, {
      limit: 5,
      offset: 0,
    });

    if (memories.total === 0) {
      return NextResponse.json(
        { ok: false, error: "The active Hindsight bank has no memories yet." },
        { status: 409 },
      );
    }

    const recallQuery = `
Analyze NovaPay's organizational history for higher-order learning across decisions, incidents, constraints, outcomes, and later capability changes.

Retrieve evidence useful for identifying:
- failure modes that appear across multiple events,
- assumptions that teams rely on and later have to revisit,
- operational constraints that shape architecture choices,
- decisions that were validated or weakened by later outcomes,
- lessons that should influence future proposals,
- changes in capabilities that make older reasoning less applicable.

Prefer evidence that connects multiple points in time. Do not invent recurrence when only one event supports a claim.
`.trim();

    const recalled = await hindsight.recall(DECISIONDNA_BANK_ID, recallQuery, {
      limit: 16,
      budget: "high",
    });

    const evidence: EvidenceItem[] = recalled.results.map((item, index) => ({
      rank: index + 1,
      text: item.text,
      type: item.type,
      score: item.score,
    }));

    if (!evidence.length) {
      return NextResponse.json({
        ok: true,
        memoryTotal: memories.total,
        summary: "No sufficiently connected organizational evidence was recalled yet.",
        patterns: [],
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
You are DecisionDNA's organizational learning analyst.

Your task is to identify up to THREE useful organizational patterns from the recalled NovaPay evidence below.

Evidence:
${evidenceBlock}

Pattern taxonomy:
- RECURRING: supported by multiple distinct events/decisions showing the same failure mode or behavior.
- EMERGING: a meaningful pattern is forming, but evidence is not yet broad enough to call it recurring.
- LESSON: a durable lesson supported by one or more outcomes, without claiming repetition.

Rules:
- Never call something RECURRING unless multiple distinct memories genuinely support recurrence.
- Connect causes, decisions, and later outcomes across time when the evidence supports it.
- Separate remembered evidence from inference.
- Do not recommend autonomous architecture changes.
- Focus on lessons that would change how an engineering or product team makes future decisions.

First return one line:
ORG_SUMMARY: <one concise sentence describing what NovaPay's history currently teaches>

Then return each pattern in exactly this format:
PATTERN_START
NAME: <short pattern name>
TYPE: <RECURRING | EMERGING | LESSON>
SIGNAL: <what the evidence shows>
WHY_IT_MATTERS: <why future teams should care>
WATCH_FOR: <specific condition or signal to monitor in future decisions>
EVIDENCE: <comma-separated memory numbers, e.g. 2,5,8>
PATTERN_END
`.trim(),
      { budget: "high" },
    );

    const text = reflection.text || "";
    const summary = readField(text, "ORG_SUMMARY") ||
      "DecisionDNA connected historical decisions, incidents, and outcomes into organizational learning.";
    const patterns = parsePatterns(text, evidence);

    return NextResponse.json({
      ok: true,
      bankId: DECISIONDNA_BANK_ID,
      memoryTotal: memories.total,
      evidenceCount: evidence.length,
      summary,
      patterns,
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
