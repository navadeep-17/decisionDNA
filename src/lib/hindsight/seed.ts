import { novapayRedisHistory } from "@/data/novapay";
import { getHindsightClient } from "./client";
import { DECISIONDNA_BANK_ID } from "./config";

export async function seedNovaPayRedisHistory() {
  const client = getHindsightClient();
  const results: Array<{ id: string; title: string }> = [];

  for (const event of novapayRedisHistory) {
    await client.retain(DECISIONDNA_BANK_ID, event.content, {
      context: `${event.type}: ${event.title}`,
      timestamp: new Date(event.date),
      metadata: {
        eventId: event.id,
        eventType: event.type,
        project: event.project,
        source: "synthetic-demo-data",
        title: event.title,
      },
    });
    results.push({ id: event.id, title: event.title });
  }

  return results;
}
