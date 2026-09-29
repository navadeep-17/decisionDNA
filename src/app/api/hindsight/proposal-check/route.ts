import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";

export const runtime = "nodejs";

const VERDICTS = [
  "WE_HAVE_TRIED_THIS_BEFORE",
  "RELATED_HISTORY",
  "NOVEL_PROPOSAL",
  "INSUFFICIENT_EVIDENCE",
] as const;

type Verdict = (typeof VERDICTS)[number];

function readField(text: string, field: string) {
  const regex = new RegExp(`^${field}:\\s*(.+)$`, "im");
  return text.match(regex)?.[1]?.trim() || "";
}

function parseVerdict(text: string): Verdict {
  const value = readField(text, "VERDICT").toUpperCase();
  return VERDICTS.includes(value as Verdict)
    ? (value as Verdict)
    : "INSUFFICIENT_EVIDENCE";
}

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { proposal?: string };
    const proposal = body.proposal?.trim();

    if (!proposal) {
      return NextResponse.json(
        { ok: false, error: "proposal is required" },
        { status: 400 },
      );
    }

    const hindsight = getHindsightClient();
    const recallQuery = `
A NovaPay team is considering this new proposal:

"${proposal}"

Search organizational memory for anything that would help the team avoid repeating past mistakes or ignoring prior learning.
Prioritize:
- earlier proposals for the same or similar approach,
- decisions that approved, rejected, limited, or superseded it,
- incidents or failures connected to the approach,
- rejected alternatives and tradeoffs,
- later outcomes that validated the old decision,
- later capability or constraint changes that may make the old reasoning less applicable now.
`.trim();

    const recalled = await hindsight.recall(DECISIONDNA_BANK_ID, recallQuery, {
      limit: 10,
      budget: "high",
    });

    const evidence = recalled.results.map((item, index) => ({
      rank: index + 1,
      text: item.text,
      type: item.type,
      score: item.score,
    }));

    const evidenceBlock = evidence.length
      ? evidence.map((item) => `[Memory ${item.rank}] ${item.text}`).join("\n\n")
      : "No related memories were recalled.";

    const reflected = await hindsight.reflect(
      DECISIONDNA_BANK_ID,
      `
You are DecisionDNA's Proposal Guard. Your job is to warn a team when a new proposal overlaps with organizational history, while recognizing when circumstances have materially changed.

New proposal:
"${proposal}"

Recalled organizational evidence:
${evidenceBlock}

Choose exactly one verdict:
- WE_HAVE_TRIED_THIS_BEFORE: the same or substantially similar proposal was previously tried/evaluated and there is concrete organizational history about what happened.
- RELATED_HISTORY: there is relevant history, but it is not the same proposal or the applicability is partial.
- NOVEL_PROPOSAL: no meaningful related organizational history was found.
- INSUFFICIENT_EVIDENCE: evidence is too weak to classify responsibly.

Important:
- Do not simply tell the team to reject the idea because it failed before.
- Explicitly mention if conditions have changed since the old decision.
- Surface the old rationale, outcomes, and current differences so a human can decide.

Return exactly these fields, each on one line:
VERDICT: <allowed verdict>
HEADLINE: <short user-facing headline>
WHAT_HAPPENED: <concise historical summary>
WHAT_CHANGED: <what is materially different now, or "No material change identified">
WATCH_OUT: <most important risk or lesson from history>
NEXT_STEP: <human review action, not an autonomous architecture decision>
`.trim(),
      { budget: "mid" },
    );

    const text = reflected.text || "";

    return NextResponse.json({
      ok: true,
      proposal,
      verdict: parseVerdict(text),
      headline: readField(text, "HEADLINE") || "Relevant organizational history found",
      whatHappened: readField(text, "WHAT_HAPPENED"),
      whatChanged: readField(text, "WHAT_CHANGED"),
      watchOut: readField(text, "WATCH_OUT"),
      nextStep: readField(text, "NEXT_STEP"),
      evidenceCount: evidence.length,
      evidence,
      raw: text,
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
