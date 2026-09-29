import { HindsightClient } from "@vectorize-io/hindsight-client";

const baseUrl = process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io";
const apiKey = process.env.HINDSIGHT_API_KEY;
const bankId = process.env.HINDSIGHT_BANK_ID || "decisiondna-novapay";

if (!apiKey) {
  console.error("Missing HINDSIGHT_API_KEY. Example: HINDSIGHT_API_KEY=hsk_... npm run memory:demo");
  process.exit(1);
}

const client = new HindsightClient({ baseUrl, apiKey });

const events = [
  ["2026-01-12", "NovaPay proposed self-managed Redis for checkout sessions to reduce latency. Priya warned that the two-person infrastructure team might not be able to operate another stateful system safely."],
  ["2026-01-18", "DEC-017 approved a limited self-managed Redis trial, conditional on memory use staying below 65 percent at peak and no additional infrastructure headcount being required."],
  ["2026-02-03", "INC-142 occurred during 4.2x traffic. Redis memory exceeded 92 percent, evictions increased, active checkout sessions were lost, and conversion dropped for 21 minutes."],
  ["2026-02-04", "INC-142 postmortem: burst traffic was underestimated, capacity alarms were weak, and the small Platform team lacked operational headroom to tune and run the cluster safely."],
  ["2026-02-05", "DEC-021 stopped using self-managed Redis for checkout sessions and returned to PostgreSQL. The main reasons were operational burden and memory-management risk. The decision explicitly allowed reconsideration if Redis operations became externally managed or the infrastructure team expanded."],
  ["2026-03-15", "PostgreSQL-backed sessions stayed stable through two campaigns with no session-loss incidents, though latency was slightly higher than Redis."],
  ["2026-08-14", "NovaPay adopted managed Redis Cloud for rate limiting. The provider now owns patching, failover, memory scaling, backups, and capacity operations, removing most direct Redis operational burden."],
  ["2026-09-10", "Managed Redis Cloud handled two traffic spikes without manual intervention and produced no Redis-related incidents in four weeks."],
] as const;

async function main() {
  console.log(`\nDecisionDNA memory proof\nBank: ${bankId}\n`);

  await client.createBank(bankId, {
    name: "DecisionDNA — NovaPay",
    background: "Organizational memory for NovaPay engineering decisions and outcomes.",
    disposition: { skepticism: 4, literalism: 4, empathy: 1 },
  });

  await client.updateBankConfig(bankId, {
    retainMission: "Retain decisions, rationale, alternatives, assumptions, constraints, incidents, outcomes, dates, causal links, and evidence that changes earlier assumptions. Preserve DEC/INC IDs.",
    retainExtractionMode: "verbose",
    observationsMission: "Synthesize recurring decision-outcome patterns and changed assumptions supported by organizational history.",
    reflectMission: "Act as an evidence-grounded organizational decision-memory analyst. Explain why decisions were made and when assumptions changed.",
    enableObservations: true,
    enableTemporalRetrieval: true,
    enableTextSearch: true,
  });

  for (const [date, content] of events) {
    process.stdout.write(`Retaining ${date} ... `);
    await client.retain(bankId, content, { timestamp: new Date(`${date}T12:00:00Z`) });
    console.log("ok");
  }

  console.log("\nRECALL — Why did NovaPay stop using Redis?\n");
  const recalled = await client.recall(
    bankId,
    "Why did NovaPay stop using Redis for checkout sessions?",
    { maxTokens: 4096, budget: "mid" },
  );
  for (const item of recalled.results.slice(0, 8)) console.log(`- ${item.text}`);

  console.log("\nREFLECT — Does DEC-021 deserve review now?\n");
  const reflected = await client.reflect(
    bankId,
    "Review DEC-021. What was the original rationale, which later facts changed, and does the decision deserve review now? Do not automatically recommend a technology migration; only assess whether the original assumptions still hold.",
    { budget: "mid" },
  );
  console.log(reflected.text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
