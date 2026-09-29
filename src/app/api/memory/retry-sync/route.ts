import { NextRequest, NextResponse } from "next/server";
import { retainEventInHindsight, type SyncableEvent } from "@/lib/memory/sync-event";
import { requireSupabaseUser } from "@/lib/supabase/require-user";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";
import { retryMemorySyncSchema } from "@/lib/validation/memory";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireSupabaseUser(request);
  if (!auth.user || !auth.token) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const parsed = retryMemorySyncSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((issue) => issue.message).join("; ") },
        { status: 400 },
      );
    }

    const supabase = createSupabaseUserClient(auth.token);
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(
        "id, project_id, external_id, event_type, title, content, event_date, hindsight_document_id, hindsight_sync_status, hindsight_sync_error, hindsight_sync_attempts, created_by",
      )
      .eq("id", parsed.data.eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { ok: false, error: "Event was not found or is not accessible." },
        { status: 404 },
      );
    }

    if (event.hindsight_sync_status === "synced" && event.hindsight_document_id) {
      return NextResponse.json({
        ok: true,
        alreadySynced: true,
        eventId: event.id,
        hindsightDocumentId: event.hindsight_document_id,
        attempts: event.hindsight_sync_attempts ?? 0,
      });
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("slug")
      .eq("id", event.project_id)
      .single();

    if (projectError || !project) {
      throw projectError || new Error("Event project could not be resolved.");
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
        event: event as SyncableEvent,
        projectSlug: project.slug,
        createdBy: event.created_by || auth.user.id,
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

      return NextResponse.json({
        ok: true,
        eventId: event.id,
        hindsightDocumentId: documentId,
        attempts,
        sync: { status: "synced" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Hindsight synchronization error";
      await supabase
        .from("events")
        .update({
          hindsight_sync_status: "failed",
          hindsight_sync_error: message.slice(0, 2_000),
        })
        .eq("id", event.id);

      return NextResponse.json(
        {
          ok: false,
          retryable: true,
          eventId: event.id,
          attempts,
          sync: { status: "failed" },
          error: message,
        },
        { status: 502 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown retry error" },
      { status: 500 },
    );
  }
}
