<div align="center">

# DecisionDNA

### Your company remembers what it decided. DecisionDNA remembers **why**.

**A persistent organizational-memory agent that connects decisions to their rationale, assumptions, incidents, constraints, alternatives, and outcomes — then detects when new evidence changes the context behind an old decision.**

`Hindsight` · `Next.js` · `TypeScript` · `Supabase` · `PostgreSQL`

</div>

---

## Why DecisionDNA Exists

Organizations are usually good at recording **what** they decided.

They are much worse at preserving:

- why the decision made sense at the time,
- what alternatives were rejected,
- which assumptions and constraints shaped it,
- which incidents influenced it,
- what happened afterward,
- and what new evidence should cause the decision to be reconsidered.

Months later, the original reasoning is scattered across tickets, postmortems, meetings, docs, and conversations — while the decision itself remains in place.

**DecisionDNA turns that lost reasoning into persistent organizational memory.**

It does not autonomously replace human decisions. It retrieves evidence, explains what changed, and recommends when a decision deserves another look.

> **Memory provides context. Evidence supports review. Humans retain authority over the decision.**

---

## The Core Idea

```text
Organizational event
        ↓
Durable source record in Supabase
        ↓
Hindsight retain()
        ↓
Persistent semantic + temporal memory
        ↓
Recall relevant organizational history
        ↓
Reflect across decisions, incidents, constraints and outcomes
        ↓
DecisionDNA intelligence
        ↓
KEEP / REVIEW / NO_IMPACT
        ↓
Human decision
```

DecisionDNA is not a stateless chatbot over company documents.

It is designed around **memory that persists, accumulates, connects over time, and changes future reasoning**.

---

# Product Capabilities

DecisionDNA organizes intelligence around the lifecycle of a decision.

## 1. Before a Decision

### Knowledge Gap Radar
Identifies the evidence the organization still lacks before a proposal is ready for human review.

It separates:

- what the organization already knows,
- what is still unknown,
- unresolved conflicts,
- and the next evidence that should be collected.

### Proposal Guard
Checks whether the organization has tried something similar before.

It retrieves:

- related historical proposals,
- prior decisions,
- rejected alternatives,
- incidents,
- outcomes,
- and context that has changed since then.

---

## 2. Understand an Existing Decision

### Decision Contract
Every important decision can carry explicit terms of validity:

- assumptions,
- success criteria,
- reversal conditions.

Hindsight evaluates those terms against current organizational memory without automatically changing the decision.

### Memory Trust Score
Explains how trustworthy the rationale behind a decision is **today** using:

- evidence support,
- outcome validation,
- consistency,
- freshness.

### Decision Drift
Detects when the assumptions or constraints behind an older decision may no longer hold.

The output is a recommendation for human review — not an autonomous reversal.

---

## 3. Understand How Memory Changed

### Memory Time Travel
Separates:

**THEN** — what the organization knew when the decision was made.

**NOW** — what the organization has learned since.

This prevents later knowledge from rewriting historical reasoning.

### Decision Shockwave
Shows how one newly learned organizational event propagates through:

- decisions,
- assumptions,
- constraints,
- and organizational lessons.

### Contradiction Radar
Distinguishes between:

- genuine contradictions,
- normal decision evolution,
- stale assumptions,
- resolved conflicts.

---

## 4. Learn Across the Organization

### Pattern Intelligence
Surfaces recurring patterns and durable lessons across organizational history.

This helps DecisionDNA move beyond single-event retrieval toward **organizational learning**.

---

# Demo Story — NovaPay

DecisionDNA ships with a synthetic fintech organization called **NovaPay** so the entire memory lifecycle can be demonstrated locally.

## The original decision

NovaPay trialed self-managed Redis for checkout sessions.

During incident `INC-142`:

- traffic reached roughly `4.2×` normal volume,
- Redis memory exceeded `92%`,
- evictions increased,
- active sessions were lost,
- checkout conversion dropped for 21 minutes,
- and the small Platform team struggled with the operational burden.

Decision `DEC-021` moved checkout sessions back to PostgreSQL.

The decision explicitly allowed Redis to be reconsidered if:

1. operational ownership became externally managed,
2. Platform capacity substantially increased,
3. or managed Redis demonstrated checkout-scale reliability without session loss or manual intervention.

## What changes later

NovaPay later adopts **managed Redis Cloud**.

The provider now handles:

- patching,
- failover,
- scaling,
- backups,
- capacity operations.

That new evidence changes one of the original constraints behind `DEC-021`.

DecisionDNA connects the new evidence to the historical decision and can surface:

```text
REVIEW_SUGGESTED
```

It does **not** automatically move checkout sessions back to Redis.

---

# Recommended Demo Flow

The strongest local demo is intentionally short:

```text
DEC-021
   ↓
Decision Contract
   ↓
Add new managed-Redis evidence
   ↓
Decision Shockwave
   ↓
Memory Time Travel
   ↓
Decision Drift
   ↓
Human review
```

This demonstrates the central idea:

> **New memory changes future reasoning because DecisionDNA remembers why the original decision existed.**

---

# Why Hindsight Is Essential

DecisionDNA intentionally does **not** recreate its own vector-memory layer inside Supabase.

## Hindsight owns

- persistent semantic and temporal organizational memory,
- extraction of durable facts and relationships,
- memory retention,
- Recall,
- Reflect,
- observations,
- cross-memory reasoning,
- changed-context discovery.

## Supabase owns

- authentication,
- organizations and memberships,
- projects,
- durable source events,
- product-facing decision records,
- alternatives and constraints,
- decision contracts,
- review workflow state,
- ingestion synchronization metadata.

This separation keeps **Hindsight as the memory + intelligence layer** and **Supabase as the transactional product-state layer**.

---

# Architecture

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
   Decision Contract      Decision Drift       Memory Intelligence
      + Trust Score         + Shockwave          + Time Travel
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                       Evidence-backed review
                                │
                                ▼
                         Human authority
```

---

# Reliability Architecture

Persistent memory is useful only if the product can trust what was retained.

DecisionDNA therefore treats Supabase as the durable ingestion record and tracks synchronization with Hindsight explicitly.

## Idempotent ingestion

Equivalent ingestion requests receive a SHA-256 idempotency fingerprint.

Submitting the same event again reuses the existing Supabase event instead of creating another logical memory.

## Hindsight synchronization lifecycle

```text
pending → synced
        ↘ failed → retry → synced
```

Each live event tracks:

- synchronization status,
- synchronization attempt count,
- last synchronization error,
- synchronization timestamp,
- stable Hindsight document ID.

If Supabase succeeds but Hindsight temporarily fails, the source event remains durable and retryable.

## Runtime validation

DecisionDNA uses **Zod** to validate ingestion payloads and centrally validates Hindsight Recall / Reflect responses before downstream intelligence features consume them.

Unexpected output fails closed instead of silently entering the decision-analysis pipeline.

---

# Supabase Data Model

The product schema includes:

```text
organizations
organization_members
projects
events
decisions
decision_alternatives
decision_constraints
decision_evidence
decision_reviews
decision_contract_terms
```

Database migrations live in:

```text
supabase/migrations/
```

Migration `007_event_hindsight_sync_state.sql` adds ingestion idempotency and Hindsight synchronization state.

---

# Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Memory / reasoning | Hindsight |
| Authentication | Supabase Auth |
| Product state | Supabase + PostgreSQL |
| Validation | Zod |
| Testing | GitHub Actions + authenticated smoke scripts |

---

# Run DecisionDNA Locally

## 1. Clone

```bash
git clone https://github.com/navadeep-17/decisionDNA.git
cd decisionDNA
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required application variables:

```bash
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=hsk_...
HINDSIGHT_BANK_ID=decisiondna-novapay

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Administrative tooling can additionally use:

```bash
SUPABASE_SERVICE_ROLE_KEY=...
```

> `HINDSIGHT_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must remain server-side and must never be committed.

## 4. Start the product

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

A public deployment is **not required** to run or demonstrate the complete product flow.

---

# Verification

## Core engineering checks

```bash
npm run typecheck
npm run build
```

Normal pushes also run the functional GitHub Actions workflow:

```text
install
  ↓
typecheck
  ↓
production build
  ↓
server boot
  ↓
homepage smoke
  ↓
protected API authentication checks
```

---

# Authenticated End-to-End Smoke

DecisionDNA includes an authenticated smoke test that signs in through Supabase and exercises the real application routes.

For localhost:

```bash
SMOKE_BASE_URL=http://localhost:3000 \
SMOKE_EMAIL=your-test-user@example.com \
SMOKE_PASSWORD=your-test-password \
npm run smoke:authenticated
```

It verifies:

- Supabase authentication,
- Hindsight status,
- Redis / `INC-142` / `DEC-021` recall,
- Reflect,
- Decision Contract,
- Memory Time Travel,
- Proposal Guard.

To additionally test **real ingestion + Hindsight synchronization + deduplication + Shockwave**:

```bash
SMOKE_MUTATE=1 \
SMOKE_BASE_URL=http://localhost:3000 \
SMOKE_EMAIL=your-test-user@example.com \
SMOKE_PASSWORD=your-test-password \
npm run smoke:authenticated
```

The mutation smoke submits the same organizational event twice and verifies that the second request reuses the existing event rather than creating duplicate organizational memory.

---

# Deterministic Demo Reset

DecisionDNA includes a guarded reset command for restoring the canonical NovaPay demo state across both Hindsight and Supabase.

```bash
CONFIRM_DEMO_RESET=RESET_NOVAPAY npm run demo:reset
```

It rebuilds:

- the DecisionDNA Hindsight bank,
- Hindsight missions/configuration,
- the eight canonical NovaPay events,
- `DEC-017`,
- `DEC-021`,
- the changed Redis operational constraint,
- the persisted Decision Drift review,
- all seven Decision Contract terms.

The command refuses to execute unless the explicit confirmation variable is provided.

---

# Security and Human Control

- All Hindsight application routes require a valid Supabase bearer session.
- Organization data is protected by Supabase Row Level Security.
- Hindsight credentials remain server-side.
- The Supabase service-role key is restricted to administrative tooling.
- DecisionDNA recommends review; it does not autonomously change organizational decisions.

---

# Repository Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── hindsight/          # memory intelligence routes
│   │   └── memory/             # ingestion + synchronization
│   └── page.tsx                # main DecisionDNA workspace
├── components/                 # intelligence capabilities + auth/UI
├── data/                       # canonical NovaPay demo history
└── lib/
    ├── hindsight/              # Hindsight client, missions, seed logic
    ├── memory/                 # synchronization + idempotency
    ├── supabase/               # authenticated DB clients
    └── validation/             # runtime schemas

scripts/
├── authenticated-smoke.ts
├── memory-demo.ts
└── reset-demo.ts

supabase/
├── migrations/
└── seed.sql
```

---

# Current Status

DecisionDNA currently supports the full local product loop:

```text
Authenticate
   ↓
Load organizational history
   ↓
Ask persistent memory
   ↓
Add new evidence
   ↓
Synchronize it into Hindsight
   ↓
Connect it to historical decisions
   ↓
Evaluate contracts / trust / contradictions / drift
   ↓
Trace downstream impact
   ↓
Recommend human review
```

The codebase also includes automated type/build/runtime smoke checks, idempotent ingestion, retryable Hindsight synchronization, runtime validation, and deterministic demo reset tooling.

---

<div align="center">

### DecisionDNA

**Remember the reasoning. Detect when the reasoning changes.**

</div>
