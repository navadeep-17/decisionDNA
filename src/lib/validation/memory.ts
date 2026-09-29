import { z } from "zod";

export const eventTypeSchema = z.enum([
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

export const ingestMemorySchema = z.object({
  title: z.string().trim().min(4).max(180),
  content: z.string().trim().min(20).max(12_000),
  eventType: eventTypeSchema.default("note"),
  eventDate: z.string().datetime({ offset: true }).optional(),
  projectSlug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/).default("checkout"),
});

export const retryMemorySyncSchema = z.object({
  eventId: z.string().uuid(),
});

export const recallEvidenceSchema = z.object({
  results: z.array(
    z.object({
      text: z.string(),
      type: z.string().optional(),
      score: z.number().optional(),
    }).passthrough(),
  ),
}).passthrough();

export const reflectResultSchema = z.object({
  text: z.string().min(1),
}).passthrough();
