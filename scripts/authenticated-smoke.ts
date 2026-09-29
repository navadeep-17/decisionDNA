import { createClient } from "@supabase/supabase-js";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Smoke assertion failed: ${message}`);
}

async function main() {
  const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = required("SMOKE_EMAIL");
  const password = required("SMOKE_PASSWORD");
  const mutate = process.env.SMOKE_MUTATE === "1";

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    throw error || new Error("Authenticated smoke could not obtain a Supabase session.");
  }

  const token = data.session.access_token;

  async function post(path: string, body?: unknown) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`${path} returned ${response.status}: ${JSON.stringify(payload)}`);
    }
    return payload as Record<string, any>;
  }

  console.log(`Authenticated as ${email}`);

  const status = await post("/api/hindsight/status");
  assert(status.ok === true, "Hindsight status route must succeed");
  assert(typeof status.total === "number" && status.total > 0, "Hindsight bank must contain memory");
  console.log(`✓ Hindsight status: ${status.total} memories`);

  const recall = await post("/api/hindsight/recall", {
    query: "Why did NovaPay stop using Redis for checkout sessions after INC-142?",
  });
  const recallText = JSON.stringify(recall).toLowerCase();
  assert(recall.ok === true, "Recall route must succeed");
  assert(recallText.includes("redis"), "Recall should recover Redis history");
  assert(recallText.includes("inc-142") || recallText.includes("dec-021"), "Recall should recover the core decision story");
  console.log("✓ Recall recovered the Redis / INC-142 / DEC-021 story");

  const reflection = await post("/api/hindsight/reflect", {
    query: "Explain why DEC-021 made sense when it was made and what later changed.",
  });
  assert(reflection.ok === true, "Reflect route must succeed");
  assert(JSON.stringify(reflection).length > 80, "Reflect must return substantive output");
  console.log("✓ Reflect returned a substantive historical explanation");

  const contract = await post("/api/hindsight/contract-check", { decisionKey: "DEC-021" });
  assert(contract.ok === true, "Decision Contract must evaluate DEC-021");
  console.log("✓ Decision Contract evaluated DEC-021");

  const replay = await post("/api/hindsight/replay", { decisionKey: "DEC-021" });
  assert(replay.ok === true, "Decision Replay must evaluate DEC-021");
  console.log("✓ Decision Replay evaluated then-vs-now context");

  const proposal = await post("/api/hindsight/proposal-check", {
    proposal: "Move checkout sessions back to managed Redis for campaign traffic.",
  });
  assert(proposal.ok === true, "Proposal Guard must return organizational history");
  console.log("✓ Proposal Guard recovered relevant prior history");

  if (mutate) {
    const event = {
      eventType: "outcome",
      title: "Managed Redis passes checkout shadow test",
      eventDate: "2026-09-29T12:00:00.000Z",
      projectSlug: "checkout",
      content:
        "NovaPay completed a checkout shadow test on managed Redis Cloud at 4.5x projected peak traffic. Automatic scaling handled the burst with zero session loss and no manual intervention from the Platform team, directly addressing the capacity and operational risks that drove DEC-021.",
    };

    const first = await post("/api/memory/ingest", event);
    assert(first.ok === true, "Live ingestion must succeed");
    assert(first.sync?.status === "synced", "Live event must be synchronized to Hindsight");
    assert(first.event?.id, "Live ingestion must return a Supabase event id");
    console.log("✓ Live event persisted and synchronized to Hindsight");

    const second = await post("/api/memory/ingest", event);
    assert(second.ok === true, "Repeated ingestion must succeed idempotently");
    assert(second.duplicate === true, "Repeated ingestion must reuse the existing event");
    assert(second.event?.id === first.event?.id, "Repeated ingestion must return the same Supabase event");
    console.log("✓ Repeated ingestion was deduplicated");

    const shockwave = await post("/api/hindsight/shockwave", { eventId: first.event.id });
    assert(shockwave.ok === true, "Shockwave must analyze the newly retained event");
    console.log("✓ Decision Shockwave analyzed the newly retained memory");

    console.log("Mutation smoke completed. Run demo:reset with explicit confirmation before recording if you want the pristine baseline restored.");
  } else {
    console.log("Read-only smoke complete. Set SMOKE_MUTATE=1 to also test live retain + idempotency + Shockwave.");
  }

  await supabase.auth.signOut();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
