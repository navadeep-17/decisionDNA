import { createClient } from "@supabase/supabase-js";
import { novapayRedisHistory } from "../src/data/novapay";
import { DECISIONDNA_BANK_ID } from "../src/lib/hindsight/config";
import { seedNovaPayRedisHistory } from "../src/lib/hindsight/seed";
import { setupDecisionDnaBank } from "../src/lib/hindsight/setup";

const CONFIRMATION = "RESET_NOVAPAY";

const ids = {
  organization: "11111111-1111-4111-8111-111111111111",
  project: "22222222-2222-4222-8222-222222222222",
  decision017: "33333333-3333-4333-8333-333333333333",
  decision021: "44444444-4444-4444-8444-444444444444",
  constraint021: "66666666-6666-4666-8666-666666666666",
  review021: "77777777-7777-4777-8777-777777777777",
};

const eventIds = Object.fromEntries(
  novapayRedisHistory.map((event, index) => [
    event.id,
    `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  ]),
) as Record<string, string>;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function resetHindsight() {
  const baseUrl = (process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io").replace(/\/$/, "");
  const apiKey = required("HINDSIGHT_API_KEY");
  const response = await fetch(
    `${baseUrl}/v1/default/banks/${encodeURIComponent(DECISIONDNA_BANK_ID)}`,
    { method: "DELETE", headers: { authorization: `Bearer ${apiKey}` } },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not clear Hindsight bank (${response.status}): ${await response.text()}`);
  }

  await setupDecisionDnaBank();
  const seed = await seedNovaPayRedisHistory();
  console.log(`Hindsight rebuilt: ${seed.events.length} source events, ${seed.memoryTotal} extracted memories.`);
}

function toEventType(type: string) {
  return type === "capability-change" ? "capability_change" : type;
}

async function resetSupabase() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: deleteError } = await supabase
    .from("organizations")
    .delete()
    .eq("slug", "novapay");
  if (deleteError) throw deleteError;

  const { error: orgError } = await supabase.from("organizations").insert({
    id: ids.organization,
    name: "NovaPay",
    slug: "novapay",
    hindsight_bank_id: DECISIONDNA_BANK_ID,
  });
  if (orgError) throw orgError;

  const { error: projectError } = await supabase.from("projects").insert({
    id: ids.project,
    organization_id: ids.organization,
    name: "Checkout",
    slug: "checkout",
    description: "Checkout session architecture and reliability decisions",
  });
  if (projectError) throw projectError;

  const now = new Date().toISOString();
  const { error: eventsError } = await supabase.from("events").insert(
    novapayRedisHistory.map((event) => ({
      id: eventIds[event.id],
      organization_id: ids.organization,
      project_id: ids.project,
      external_id: event.id,
      event_type: toEventType(event.type),
      title: event.title,
      content: event.content,
      source: "synthetic-demo-data",
      event_date: event.date,
      hindsight_document_id: event.id,
      hindsight_sync_status: "synced",
      hindsight_sync_error: null,
      hindsight_sync_attempts: 1,
      hindsight_synced_at: now,
    })),
  );
  if (eventsError) {
    throw new Error(
      `${eventsError.message}. Ensure migration 007_event_hindsight_sync_state.sql has been applied before demo:reset.`,
    );
  }

  const { error: decisionsError } = await supabase.from("decisions").insert([
    {
      id: ids.decision017,
      organization_id: ids.organization,
      project_id: ids.project,
      decision_key: "DEC-017",
      title: "Redis Trial Approved",
      summary: "Limited rollout of self-managed Redis for checkout sessions.",
      decision: "Approve a limited Redis trial subject to memory and staffing constraints.",
      rationale:
        "Evaluate lower-latency session storage while ensuring memory stays below 65 percent under peak load and no additional infrastructure headcount is required.",
      status: "superseded",
      confidence: 0.95,
      decision_date: "2026-01-18T11:00:00.000Z",
    },
    {
      id: ids.decision021,
      organization_id: ids.organization,
      project_id: ids.project,
      decision_key: "DEC-021",
      title: "Redis Session Architecture",
      summary: "Return checkout sessions to PostgreSQL after the Redis incident.",
      decision: "Use PostgreSQL-backed checkout sessions instead of self-managed Redis.",
      rationale:
        "INC-142 exposed memory-pressure risk and unsustainable operational burden for the small Platform team.",
      status: "review_suggested",
      confidence: 0.94,
      decision_date: "2026-02-05T16:00:00.000Z",
    },
  ]);
  if (decisionsError) throw decisionsError;

  const { error: constraintError } = await supabase.from("decision_constraints").insert({
    id: ids.constraint021,
    decision_id: ids.decision021,
    constraint_text:
      "Redis operational ownership and memory-management burden must be manageable by NovaPay's small Platform team.",
    status: "changed",
    original_evidence_event_id: eventIds["EVT-005"],
    changed_by_event_id: eventIds["EVT-007"],
    changed_at: "2026-08-14T09:00:00.000Z",
  });
  if (constraintError) throw constraintError;

  const { error: reviewError } = await supabase.from("decision_reviews").insert({
    id: ids.review021,
    decision_id: ids.decision021,
    status: "review_suggested",
    reason:
      "The original operational-ownership constraint changed after NovaPay adopted managed Redis Cloud.",
    analysis:
      "DEC-021 should be re-evaluated because a key assumption behind the original rejection is no longer true. This is a review recommendation, not an automatic migration decision.",
    confidence: 0.94,
    evidence_count: 20,
  });
  if (reviewError) throw reviewError;

  const contractTerms = [
    ["A1", "assumption", "Checkout-session reliability requires avoiding Redis memory-eviction risk during burst traffic.", "active", 10],
    ["A2", "assumption", "Operating Redis for checkout sessions creates unacceptable operational burden for the small Platform team.", "active", 20],
    ["S1", "success_criterion", "Checkout sessions remain reliable during campaign-scale traffic without session loss.", "active", 30],
    ["S2", "success_criterion", "The chosen session architecture keeps operational ownership manageable for the Platform team.", "active", 40],
    ["R1", "reversal_condition", "Redis operational work is materially externalized through a managed service that handles scaling, failover, patching, backups, and capacity.", "not_met", 50],
    ["R2", "reversal_condition", "Platform-team capacity expands substantially enough that Redis operational ownership is no longer a limiting constraint.", "not_met", 60],
    ["R3", "reversal_condition", "Managed Redis demonstrates checkout-scale burst reliability with zero session loss and no manual Platform-team intervention.", "not_met", 70],
  ] as const;

  const { error: contractError } = await supabase.from("decision_contract_terms").insert(
    contractTerms.map(([term_key, term_type, term_text, baseline_status, sort_order]) => ({
      decision_id: ids.decision021,
      term_key,
      term_type,
      term_text,
      baseline_status,
      sort_order,
    })),
  );
  if (contractError) throw contractError;

  console.log(`Supabase rebuilt: ${novapayRedisHistory.length} events, 2 decisions, 7 contract terms.`);
}

async function main() {
  if (process.env.CONFIRM_DEMO_RESET !== CONFIRMATION) {
    throw new Error(
      `Refusing destructive reset. Set CONFIRM_DEMO_RESET=${CONFIRMATION} only when you intentionally want to rebuild the NovaPay demo state.`,
    );
  }

  console.log("Resetting DecisionDNA NovaPay demo state...");
  await resetHindsight();
  await resetSupabase();
  console.log("DecisionDNA demo reset complete. Sign in again so AuthShell recreates demo membership.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
