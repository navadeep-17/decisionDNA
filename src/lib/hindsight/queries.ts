import { getHindsightClient } from "./client";
import { DECISIONDNA_BANK_ID } from "./config";

export async function recallDecisionHistory(query: string) {
  const client = getHindsightClient();
  return client.recall(DECISIONDNA_BANK_ID, query, {
    limit: 8,
    budget: "mid",
  });
}

export async function reflectOnDecision(query: string) {
  const client = getHindsightClient();
  return client.reflect(DECISIONDNA_BANK_ID, query, {
    budget: "mid",
  });
}

export const REDIS_DRIFT_QUERY = `
Review NovaPay's decision to stop using Redis for checkout session storage.

Determine:
1. the original decision and its date/ID,
2. the main reasons and constraints behind it,
3. what later evidence has changed since that decision,
4. whether any original assumption or constraint is no longer true,
5. whether the decision deserves review now.

Do not claim that NovaPay should switch technologies automatically. The output is a review recommendation, not an autonomous architecture change. Ground the answer in remembered organizational history.
`.trim();
