import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import { requireSupabaseUser } from "@/lib/supabase/require-user";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";

export const runtime = "nodejs";

const EVENT_TYPES = new Set([
  "proposal",
  "decision",
  "incident",
  "investigation",
  "outcome",
  "constraint",
  "capability_change",
  "meeting",
  "note",
]);

type IngestBody = {
  title?: string;
  content?: string;
  eventType?: string;
  eventDate?: string;
  projectSlug?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user || !auth.token) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = (await request.json()) as IngestBody;
    const title = body.title?.trim();
    const content = body.content?.trim();
    const eventType = body.eventType?.trim() || "note";
    const projectSlug = body.projectSlug?.trim() || "checkout";
    const eventDate = body.eventDate ? new Date(body.eventDate) : new Date();

    if (!title || title.length < 4) {
      return NextResponse.json(
        { ok: false, error: "A descriptive title is required." },
        { status: 400 },
      );
    }

    if (!content || content.length < 20) {
      return NextResponse.json(
        { ok: false, error: "Memory content must be at least 20 characters." },
        { status: 400 },
      );
    }

    if (!EVENT_TYPES.has(eventType)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported organizational event type." },
        { status: 400 },
      );
    }

    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: "eventDate must be a valid date." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseUserClient(auth.token);

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id, hindsight_bank_id")
      .eq("slug", "novapay")
      .single();

    if (organizationError || !organization) {
      throw organizationError || new Error("NovaPay workspace could not be resolved.");
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, slug, name")
      .eq("organization_id", organization.id)
      .eq("slug", projectSlug)
      .single();

    if (projectError || !project) {
      throw projectError || new Error(`Project ${projectSlug} could not be resolved.`);
    }

    const eventId = `LIVE-${Date.now()}-${randomUUID().split("-")[0].toUpperCase()}`;

    const { data: storedEvent, error: insertError } = await supabase
      .from("events")
      .insert({
        organization_id: organization.id,
        project_id: project.id,
        external_id: eventId,
        event_type: eventType,
        title,
        content,
        source: "decisiondna-live-ingestion",
        event_date: eventDate.toISOString(),
        hindsight_document_id: null,
        created_by: auth.user.id,
      })
      .select("id, external_id, event_type, title, content, event_date")
      .single();

    if (insertError || !storedEvent) {
      throw insertError || new Error("Supabase event insert failed.");
    }

    const hindsight = getHindsightClient();

    try {
      await hindsight.retainBatch(
        DECISIONDNA_BANK_ID,
        [
          {
            content,
            context: `${eventType}: ${title}`,
            timestamp: eventDate,
            document_id: eventId,
            metadata: {
              eventId,
              eventType,
              project: project.slug,
              source: "decisiondna-live-ingestion",
              title,
              createdBy: auth.user.id,
            },
            tags: [
              "org:novapay",
              `project:${project.slug}`,
              `event:${eventType}`,
              "source:decisiondna-live-ingestion",
            ],
            observation_scopes: "shared",
          },
        ],
        { async: false },
      );

      const { error: syncError } = await supabase
        .from("events")
        .update({ hindsight_document_id: eventId })
        .eq("id", storedEvent.id);

      if (syncError) {
        console.error("Event retained in Hindsight but Supabase sync marker failed", syncError);
      }
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          partial: true,
          stage: "hindsight-retain",
          event: storedEvent,
          error:
            error instanceof Error
              ? `Event was stored in Supabase, but Hindsight retain failed: ${error.message}`
              : "Event was stored in Supabase, but Hindsight retain failed.",
        },
        { status: 502 },
      );
    }

    const recallQuery = `
A new NovaPay organizational event was just retained:
Title: ${title}
Type: ${eventType}
Content: ${content}

Find the most relevant historical decisions, incidents, constraints, and outcomes that this new event could affect. Prioritize explicit decision IDs and the reasons behind those decisions.
`.trim();

    const recalled = await hindsight.recall(DECISIONDNA_BANK_ID, recallQuery, {
      limit: 8,
      budget: "mid",
    });

    const evidence = recalled.results.map((item, index) => ({
      rank: index + 1,
      text: item.text,
      type: item.type,
      score: item.score,
    }));

    const evidenceBlock = evidence
      .map((item) => `[Memory ${item.rank}] ${item.text}`)
      .join("\n\n");

    const impact = await hindsight.reflect(
      DECISIONDNA_BANK_ID,
      `
You are DecisionDNA's organizational-memory analyst.

A new event has just been added:
- Title: ${title}
- Type: ${eventType}
- Date: ${eventDate.toISOString()}
- Content: ${content}

Hindsight recalled this related organizational history:
${evidenceBlock || "No related memories were recalled."}

Analyze the effect of the new event on existing organizational decisions. Return a concise answer with exactly these sections:
Affected decision(s)
What changed
Why it matters
Recommended action

Recommended action must be one of KEEP, REVIEW, or NO_IMPACT. Do not autonomously reverse or replace a human decision.
`.trim(),
      { budget: "mid" },
    );

    const memoryList = await hindsight.listMemories(DECISIONDNA_BANK_ID, {
      limit: 1,
      offset: 0,
    });

    return NextResponse.json({
      ok: true,
      event: storedEvent,
      hindsightDocumentId: eventId,
      memoryTotal: memoryList.total,
      impactEvidenceCount: evidence.length,
      impactEvidence: evidence,
      impact: impact.text,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown ingestion error",
      },
      { status: 500 },
    );
  }
}
