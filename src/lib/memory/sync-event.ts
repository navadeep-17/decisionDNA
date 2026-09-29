import { createHash } from "node:crypto";
import { getHindsightClient } from "@/lib/hindsight/client";
import { DECISIONDNA_BANK_ID } from "@/lib/hindsight/config";

export type SyncableEvent = {
  id: string;
  external_id: string | null;
  event_type: string;
  title: string;
  content: string;
  event_date: string;
  hindsight_sync_attempts?: number | null;
};

export function normalizeFingerprintText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function createEventIdempotencyKey(input: {
  organizationId: string;
  projectId: string;
  eventType: string;
  title: string;
  content: string;
  eventDate: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.organizationId,
        input.projectId,
        input.eventType,
        normalizeFingerprintText(input.title),
        normalizeFingerprintText(input.content),
        new Date(input.eventDate).toISOString(),
      ]),
    )
    .digest("hex");
}

export async function retainEventInHindsight(input: {
  event: SyncableEvent;
  projectSlug: string;
  createdBy: string;
}) {
  const documentId = input.event.external_id || `EVENT-${input.event.id}`;
  const hindsight = getHindsightClient();

  await hindsight.retainBatch(
    DECISIONDNA_BANK_ID,
    [
      {
        content: input.event.content,
        context: `${input.event.event_type}: ${input.event.title}`,
        timestamp: new Date(input.event.event_date),
        document_id: documentId,
        metadata: {
          eventId: documentId,
          eventType: input.event.event_type,
          project: input.projectSlug,
          source: "decisiondna-live-ingestion",
          title: input.event.title,
          createdBy: input.createdBy,
          supabaseEventId: input.event.id,
        },
        tags: [
          "org:novapay",
          `project:${input.projectSlug}`,
          `event:${input.event.event_type}`,
          "source:decisiondna-live-ingestion",
        ],
        observation_scopes: "shared",
      },
    ],
    { async: false },
  );

  return documentId;
}
