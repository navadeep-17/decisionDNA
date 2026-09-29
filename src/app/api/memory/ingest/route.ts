import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";
import {
  createEventIdempotencyKey,
  retainEventInHindsight,
  type SyncableEvent,
} from "@/lib/memory/sync-event";
import { requireSupabaseUser } from "@/lib/supabase/require-user";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";
import {
  ingestMemorySchema,
  recallEvidenceSchema,
  reflectResultSchema,
} from "@/lib/validation/memory";

export const runtime = "nodejs";

type StoredEvent = SyncableEvent & {
  hindsight_document_id?: string | null;
  hindsight_sync_status?: "pending" | "synced" | "failed" | null;
  hindsight_sync_error?: string | null;
};

function validationMessage(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
    .join("; ");
}

async function synchronizeEvent(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  event: StoredEvent,
  projectSlug: string,
  userId: string,
) {
  if (event.hindsight_sync_status === "synced" && event.hindsight_document_id) {
    return {
      ok: true as const,
      documentId: event.hindsight_document_id,
      attempts: event.hindsight_sync_attempts ?? 0,
      alreadySynced: true,
    };
  }

  const attempts = (event.hindsight_sync_attempts ?? 0) + 1;
  const { error: pendingError } = await supabase
    .from("events")
    .update({
      hindsight_sync_status: "pending",
      hindsight_sync_error: null,
      hindsight_sync_attempts: attempts,
    })
    .eq("id", event.id);

  if (pendingError) throw pendingError;

  try {
    const documentId = await retainEventInHindsight({
      event: { ...event, hindsight_sync_attempts: attempts },
      projectSlug,
      createdBy: userId,
    });

    const { error: syncedError } = await supabase
      .from("events")
      .update({
        hindsight_document_id: documentId,
        hindsight_sync_status: "synced",
        hindsight_sync_error: null,
        hindsight_synced_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    if (syncedError) throw syncedError;

    return { ok: true as const, documentId, attempts, alreadySynced: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Hindsight synchronization error";

    const { error: failedStateError } = await supabase
      .from("events")
      .update({
        hindsight_sync_status: "failed",
        hindsight_sync_error: message.slice(0, 2_000),
      })
      .eq("id", event.id);

    if (failedStateError) {
      console.error("Failed to persist Hindsight synchronization error", failedStateError);
    }

    return { ok: false as const, error: message, attempts };
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user || !auth.token) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const parsed = ingestMemorySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: validationMessage(parsed.error) },
        { status: 400 },
      );
    }

    const {
      title,
      content,
      eventType,
      projectSlug,
      eventDate: requestedEventDate,
    } = parsed.data;
    const eventDate = requestedEventDate ? new Date(requestedEventDate) : new Date();
    const eventDateIso = eventDate.toISOString();
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

    const idempotencyKey = createEventIdempotencyKey({
      organizationId: organization.id,
      projectId: project.id,
      eventType,
      title,
      content,
      eventDate: eventDateIso,
    });

    const eventSelect =
      "id, external_id, event_type, title, content, event_date, hindsight_document_id, hindsight_sync_status, hindsight_sync_error, hindsight_sync_attempts";

    const { data: existingEvent, error: existingError } = await supabase
      .from("events")
      .select(eventSelect)
      .eq("organization_id", organization.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingError) throw existingError;

    let storedEvent = existingEvent as StoredEvent | null;
    let duplicate = Boolean(existingEvent);

    if (!storedEvent) {
      const externalId = `LIVE-${Date.now()}-${randomUUID().split("-")[0].toUpperCase()}`;
      const { data: inserted, error: insertError } = await supabase
        .from("events")
        .insert({
          organization_id: organization.id,
          project_id: project.id,
          external_id: externalId,
          event_type: eventType,
          title,
          content,
          source: "decisiondna-live-ingestion",
          event_date: eventDateIso,
          hindsight_document_id: null,
          idempotency_key: idempotencyKey,
          hindsight_sync_status: "pending",
          hindsight_sync_error: null,
          hindsight_sync_attempts: 0,
          created_by: auth.user.id,
        })
        .select(eventSelect)
        .single();

      if (insertError || !inserted) {
        // Two identical requests may race. The unique idempotency index is the final guard.
        if ((insertError as { code?: string } | null)?.code === "23505") {
          const { data: racedEvent, error: racedError } = await supabase
            .from("events")
            .select(eventSelect)
            .eq("organization_id", organization.id)
            .eq("idempotency_key", idempotencyKey)
            .single();
          if (racedError || !racedEvent) throw racedError || insertError;
          storedEvent = racedEvent as StoredEvent;
          duplicate = true;
        } else {
          throw insertError || new Error("Supabase event insert failed.");
        }
      } else {
        storedEvent = inserted as StoredEvent;
      }
    }

    if (!storedEvent) throw new Error("Event could not be resolved after ingestion.");

    const sync = await synchronizeEvent(
      supabase,
      storedEvent,
      project.slug,
      auth.user.id,
    );

    if (!sync.ok) {
      return NextResponse.json(
        {
          ok: false,
          partial: true,
          duplicate,
          retryable: true,
          stage: "hindsight-retain",
          event: storedEvent,
          sync: { status: "failed", attempts: sync.attempts, error: sync.error },
          error: `Event is safely stored in Supabase, but Hindsight synchronization failed: ${sync.error}`,
        },
        { status: 502 },
      );
    }

    const hindsight = getHindsightClient();

    if (duplicate && sync.alreadySynced) {
      let memoryTotal: number | undefined;
      try {
        memoryTotal = (
          await hindsight.listMemories(DECISIONDNA_BANK_ID, { limit: 1, offset: 0 })
        ).total;
      } catch {
        // Idempotency success does not depend on the optional status count.
      }

      return NextResponse.json({
        ok: true,
        duplicate: true,
        event: storedEvent,
        hindsightDocumentId: sync.documentId,
        memoryTotal,
        impactEvidenceCount: 0,
        impactEvidence: [],
        impact:
          "This organizational event was already stored and synchronized. DecisionDNA reused the existing memory instead of creating a duplicate.",
        sync: { status: "synced", attempts: sync.attempts },
      });
    }

    let evidence: Array<{ rank: number; text: string; type?: string; score?: number }> = [];
    let impactText =
      "Memory was retained successfully. Impact analysis is temporarily unavailable, but the event can be analyzed again without re-ingesting it.";
    let analysisWarning: string | undefined;

    try {
      const recallQuery = `
A new NovaPay organizational event was just retained:
Title: ${title}
Type: ${eventType}
Content: ${content}

Find the most relevant historical decisions, incidents, constraints, and outcomes that this new event could affect. Prioritize explicit decision IDs and the reasons behind those decisions.
`.trim();

      const recalledRaw = await hindsight.recall(DECISIONDNA_BANK_ID, recallQuery, {
        limit: 8,
        budget: "mid",
      });
      const recalled = recallEvidenceSchema.parse(recalledRaw);

      evidence = recalled.results.map((item, index) => ({
        rank: index + 1,
        text: item.text,
        type: item.type,
        score: item.score,
      }));

      const evidenceBlock = evidence
        .map((item) => `[Memory ${item.rank}] ${item.text}`)
        .join("\n\n");

      const impactRaw = await hindsight.reflect(
        DECISIONDNA_BANK_ID,
        `
You are DecisionDNA's organizational-memory analyst.

A new event has just been added:
- Title: ${title}
- Type: ${eventType}
- Date: ${eventDateIso}
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
      impactText = reflectResultSchema.parse(impactRaw).text;
    } catch (error) {
      analysisWarning =
        error instanceof Error
          ? `Memory synchronized, but impact output failed runtime validation: ${error.message}`
          : "Memory synchronized, but impact output failed runtime validation.";
    }

    let memoryTotal: number | undefined;
    try {
      memoryTotal = (
        await hindsight.listMemories(DECISIONDNA_BANK_ID, { limit: 1, offset: 0 })
      ).total;
    } catch {
      // Optional metadata only.
    }

    return NextResponse.json({
      ok: true,
      duplicate,
      event: storedEvent,
      hindsightDocumentId: sync.documentId,
      memoryTotal,
      impactEvidenceCount: evidence.length,
      impactEvidence: evidence,
      impact: impactText,
      analysisWarning,
      sync: { status: "synced", attempts: sync.attempts },
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
