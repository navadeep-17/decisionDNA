import { HindsightClient } from "@vectorize-io/hindsight-client";

let client: HindsightClient | null = null;

export function getHindsightClient() {
  if (client) return client;

  const baseUrl = process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io";
  const apiKey = process.env.HINDSIGHT_API_KEY;

  if (!apiKey) {
    throw new Error(
      "HINDSIGHT_API_KEY is missing. Copy .env.example to .env.local and add your Hindsight Cloud API key.",
    );
  }

  client = new HindsightClient({ baseUrl, apiKey });
  return client;
}
