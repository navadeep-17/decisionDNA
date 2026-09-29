<div align="center">

# DecisionDNA

### Your company remembers what it decided. DecisionDNA remembers **why**.

DecisionDNA is a persistent organizational-memory agent that captures the rationale, assumptions, constraints, incidents, alternatives, and outcomes behind decisions — then recognizes when later evidence changes the context that made an older decision valid.

**Hindsight · Next.js · TypeScript · Supabase · PostgreSQL**

</div>

---

## The Problem

Teams usually retain the final decision but lose the reasoning that produced it.

Months later:

- the original constraint may no longer exist,
- a rejected alternative may have become viable,
- a past incident may be forgotten,
- new evidence may contradict an old assumption,
- and the organization may unknowingly repeat a previous mistake.

DecisionDNA creates durable organizational memory around **why** decisions were made and continuously makes that reasoning inspectable.

It never autonomously replaces a human decision. It retrieves evidence, explains changed assumptions, and recommends review.

---

## Core Product Loop

```text
Organizational event
        ↓
Supabase durable source record
        ↓
Hindsight retain()
        ↓
Persistent semantic + temporal memory
        ↓
Recall related organizational history
        ↓
Reflect across decisions, incidents, constraints and outcomes
        ↓
DecisionDNA intelligence
        ↓
KEEP / REVIEW / NO_IMPACT
        ↓
Human decision
```

---

## What DecisionDNA Can Do

### Before a decision

- **Knowledge Gap Radar** — identifies evidence the organization still lacks before a proposal is ready for human review.
- **Proposal Guard** — surfaces similar prior attempts, rejected alternatives, incidents, and outcomes so teams do not unknowingly repeat history.

### Understand an existing decision

- **Decision Contract** — records assumptions, success criteria, and explicit reversal conditions such as “reconsider if operational ownership becomes managed externally.”
- **Memory Trust Score** — explains how evidence support, outcomes, consistency, and freshness affect confidence in a decision's rationale today.
- **Decision Drift** — detects when evidence suggests that an assumption or constraint behind an older decision has materially changed.

### Understand how memory changed

- **Memory Time Travel** — separates what was known when a decision was made from facts learned later.
- **Decision Shockwave** — traces how a new organizational event affects decisions, assumptions, and lessons.
- **Contradiction Radar** — separates genuine contradictory memories from normal decision evolution and stale assumptions.

### Learn across the organization

- **Pattern Intelligence** — surfaces recurring organizational patterns and reusable lessons across remembered history.

---

## Demo Scenario — NovaPay

DecisionDNA currently uses a synthetic fintech company, **NovaPay**, to demonstrate the complete memory lifecycle.

### Historical decision

`DEC-021` moved checkout sessions back to PostgreSQL after incident `INC-142` exposed Redis memory pressure and an unsustainable operational burden for NovaPay's small Platform team.

The decision explicitly allowed reconsideration if:

- Redis operations became externally managed,
- Platform capacity substantially increased,
- or managed Redis demonstrated checkout-scale reliability without session loss or manual intervention.

### Later evidence

NovaPay later adopts managed Redis Cloud, externalizing patching, failover, scaling, backups, and capacity operations.

DecisionDNA connects that new evidence to the original decision contract and recommends:

```text
REVIEW_SUGGESTED
```

It does **not** automatically migrate the architecture.

---

## Why Hindsight Is Central

DecisionDNA intentionally does not recreate a vector-memory system in Supabase.

### Hindsight owns

- persistent semantic and temporal organizational memory,
- extraction of durable facts and relationships,
- Recall,
- Reflect,
- observations and cross-memory reasoning,
- changed-context discovery.

### Supabase owns

- authentication,
- organizations and memberships,
- projects,
- durable source events,
- product-facing decision records,
- constraints and alternatives,
- decision contracts,
- review workflow state,
- synchronization metadata.

That boundary keeps Hindsight as the intelligence and memory layer while Supabase remains the transactional product-state layer.

---

## Architecture

```text
                         User / source event
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │       Supabase         │
                    │ durable source record  │
                    └───────────┬────────────┘
                                │
                    stable document identity
                                │
                                ▼
                    ┌────────────────────────┐
                    │       Hindsight        │
                    │ retain → recall →      │
                    │ reflect → observations │
                    └───────────┬────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
   Decision Contract      Decision Drift       Knowledge / Memory
      + Trust Score         + Shockwave          Intelligence
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                       Evidence-backed review
                                │
                                ▼
                         Human authority
```

---

## Reliability Architecture

A persistent-memory product must avoid silently drifting between its transactional store and memory store.

DecisionDNA therefore treats Supabase as the durable ingestion record and tracks Hindsight synchronization explicitly.

### Idempotent ingestion

Equivalent ingestion requests receive a SHA-256 idempotency fingerprint. Repeating the same request reuses the existing Supabase event instead of creating another logical memory.

### Hindsight synchronization lifecycle

Every live event tracks:

```text
pending → synced
        ↘ failed → retry → synced
```

The event stores:

- synchronization status,
- synchronization attempt count,
- last synchronization error,
- synchronization timestamp,
- stable Hindsight document ID.

If Supabase succeeds but Hindsight temporarily fails, the event remains durable and retryable.

### Runtime validation

DecisionDNA uses Zod to validate ingestion payloads and centrally validates Hindsight Recall and Reflect responses before downstream intelligence features consume them.

Unexpected output fails closed rather than silently entering the decision-analysis pipeline.

---

## Data Model

The Supabase schema includes:

- `organizations`
- `organization_members`
- `projects`
- `events`
- `decisions`
- `decision_alternatives`
- `decision_constraints`
- `decision_evidence`
- `decision_reviews`
- `decision_contract_terms`

The current migrations are under:

```text
supabase/migrations/
```

Migration `007_event_hindsight_sync_state.sql` adds ingestion idempotency and Hindsight synchronization state.

---

## Local Setup

```bash
git clone https://github.com/navadeep-17/decisionDNA.git
cd decisionDNA
cp .env.example .env.local
npm install
npm run dev
```

Required application configuration:

```bash
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=hsk_...
HINDSIGHT_BANK_ID=decisiondna-novapay

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` is only needed for administrative reset tooling. It must never be exposed to the browser or committed to Git.

---

## Automated Verification

Normal pushes run the functional smoke workflow:

```text
install dependencies
      ↓
TypeScript typecheck
      ↓
production Next.js build
      ↓
production server boot
      ↓
homepage HTTP smoke
      ↓
protected API authentication-boundary checks
```

You can run the core checks locally with:

```bash
npm run typecheck
npm run build
```

---

## Authenticated Product Smoke

DecisionDNA also includes a real authenticated smoke script:

```bash
npm run smoke:authenticated
```

Required variables:

```bash
SMOKE_BASE_URL=https://your-deployment.example
SMOKE_EMAIL=...
SMOKE_PASSWORD=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The read-only smoke verifies:

- Supabase authentication,
- Hindsight status,
- Recall of the Redis / `INC-142` / `DEC-021` story,
- Reflect,
- Decision Contract,
- Memory Time Travel,
- Proposal Guard.

To additionally test a real retain, deduplication, and Decision Shockwave:

```bash
SMOKE_MUTATE=1 npm run smoke:authenticated
```

A manual GitHub Actions workflow is also available at:

```text
.github/workflows/authenticated-smoke.yml
```

This allows the deployed application to keep the Hindsight API key private while the smoke test authenticates through Supabase and exercises the real product routes.

---

## Deterministic Demo Reset

A guarded reset command can rebuild the NovaPay demo across both Hindsight and Supabase:

```bash
CONFIRM_DEMO_RESET=RESET_NOVAPAY npm run demo:reset
```

It:

1. deletes and recreates the DecisionDNA Hindsight bank,
2. reapplies the bank missions/configuration,
3. retains the canonical NovaPay history,
4. rebuilds NovaPay's Supabase events and decisions,
5. recreates `DEC-021` constraints, review state, and seven Decision Contract terms.

The command refuses to run unless the explicit confirmation variable is present.

---

## Security / Human Control

- Hindsight routes require a valid Supabase bearer session.
- Organization data is protected with Supabase Row Level Security.
- The Hindsight API key remains server-side.
- The Supabase service-role key remains administrative/server-only.
- DecisionDNA recommends review; humans retain authority over the final decision.

---

## Design Principle

> **Memory provides context. Evidence supports review. Humans retain authority over the decision.**

DecisionDNA is designed to make organizational reasoning inspectable over time — especially when yesterday's assumptions stop being true.
