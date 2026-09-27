export const DECISIONDNA_BANK_ID =
  process.env.HINDSIGHT_BANK_ID || "decisiondna-novapay";

export const RETAIN_MISSION = `
Extract and retain organizational knowledge that helps explain why NovaPay made decisions and whether those decisions remain valid.
Prioritize: decisions, rationale, rejected alternatives, assumptions, constraints, incidents, outcomes, people/teams, systems, dates, causal relationships, lessons learned, and later evidence that changes an earlier assumption.
Preserve decision IDs and incident IDs when present.
Ignore greetings, logistics, and conversational filler.
`.trim();

export const OBSERVATIONS_MISSION = `
Synthesize stable organizational patterns, recurring causes, decision-outcome relationships, and assumptions that appear to have changed over time. Prefer observations supported by multiple memories.
`.trim();

export const REFLECT_MISSION = `
Act as DecisionDNA, NovaPay's organizational decision-memory analyst. Explain conclusions from remembered evidence, distinguish historical facts from recommendations, cite decision or incident identifiers when available, and explicitly identify which assumption or constraint changed when suggesting that an old decision deserves review.
`.trim();
