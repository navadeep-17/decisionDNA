import { novapayRedisHistory } from "@/data/novapay";
import { getHindsightClient } from "./client";
import { DECISIONDNA_BANK_ID } from "./config";

export async function seedNovaPayRedisHistory() {
  const client = getHindsightClient();

  const items = novapayRedisHistory.map((event) => ({
    content: event.content,
    context: `${event.type}: ${event.title}`,
    timestamp: new Date(event.date),
    document_id: event.id,
    metadata: {
      eventId: event.id,
      eventType: event.type,
      project: event.project,
      source: "synthetic-demo-data",
      title: event.title,
    },
    tags: [
      "org:novapay",
      `project:${event.project}`,
      `event:${event.type}`,
      `source:synthetic-demo-data`,
    ],
    observation_scopes: "shared" as const,
  }));

  const retainResult = await client.retainBatch(DECISIONDNA_BANK_ID, items, {
    async: false,
  });

  const memoryList = await client.listMemories(DECISIONDNA_BANK_ID, {
    limit: 100,
    offset: 0,
  });

  if (memoryList.total === 0) {
    throw new Error(
      "Hindsight accepted the retain request but the bank still contains zero memories. Check the bank configuration and Hindsight Cloud logs before running recall/reflect.",
    );
  }

  return {
    events: novapayRedisHistory.map(({ id, title, type, date }) => ({
      id,
      title,
      type,
      date,
    })),
    retainResult,
    memoryTotal: memoryList.total,
  };
}
