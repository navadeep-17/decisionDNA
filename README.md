<div align="center">

# DecisionDNA

### Organizational memory that remembers not just **what** was decided — but **why**.

DecisionDNA is an organizational decision-memory system that preserves decisions, assumptions, constraints, evidence, and later outcomes so teams can detect when the reasoning behind an old decision may no longer be valid.

**Hindsight · Next.js · TypeScript · Supabase · PostgreSQL**

</div>

---

## Why DecisionDNA

Most teams remember the final decision but gradually lose the context that produced it. Months later, the original constraint may disappear while the decision itself remains unquestioned.

DecisionDNA closes that gap by maintaining durable organizational memory and surfacing **Decision Drift** when later events weaken or invalidate the assumptions behind an earlier choice.

It does not automatically rewrite organizational decisions. It brings back the evidence and recommends review when the historical reasoning no longer matches current reality.

---

## Core Product Loop

```text
Organizational events
        ↓
Hindsight retain()
        ↓
Persistent organizational memory
        ↓
Recall evidence + Reflect across history
        ↓
DecisionDNA decision model
        ↓
Decision health + constraint tracking
        ↓
Decision Drift detection
        ↓
REVIEW_SUGGESTED + evidence trail
```

---

## Product Highlights

- **Decision Memory** — store what was decided, why, alternatives considered, and supporting evidence.
- **Decision Drift** — detect when later events invalidate an original constraint or assumption.
- **Evidence-backed Review** — show the exact memories and events supporting a suggested review.
- **Organizational Timeline** — trace a decision from proposal through incidents and changed constraints.
- **Ask Organizational Memory** — query organizational history using Recall and Reflect modes.
- **Human-in-the-loop** — DecisionDNA recommends review instead of silently changing architecture or policy.
- **Separation of concerns** — Hindsight owns semantic memory; Supabase owns application state and workflow.

---

## Demo Scenario

The current product uses a synthetic fintech company, **NovaPay**, to demonstrate the full memory loop.

Decision `DEC-021` originally moved checkout sessions away from self-managed Redis after incident `INC-142` exposed an operational constraint. Later, the organization adopts managed Redis, removing the constraint that originally drove the decision.

DecisionDNA connects those events and returns:

```text
REVIEW_SUGGESTED
```

rather than automatically changing the architecture.

The reviewer can inspect the historical evidence that caused the recommendation.

---

## Architecture

```text
                     Organizational events
                              │
                              ▼
                     Hindsight retain()
                              │
                              ▼
                Persistent organizational memory
                    │                     │
                    ▼                     ▼
               recall()               reflect()
                 evidence         cross-memory reasoning
                    │                     │
                    └──────────┬──────────┘
                               ▼
                     DecisionDNA product layer
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   Decision health      Decision Drift         Timeline
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
                         Evidence trail
                               │
                               ▼
                            Supabase
```

### Responsibility Boundary

**Hindsight owns**

- semantic and temporal organizational memory
- fact/entity/relationship extraction
- retrieval
- observations
- cross-memory reasoning

**Supabase owns**

- users and organizations
- projects
- source events
- product-facing decision records
- constraints and alternatives
- evidence links
- review workflow state

DecisionDNA intentionally does **not** recreate Hindsight with pgvector.

---

## Current Product Surface

The dashboard includes:

- organizational memory health
- decision-health metrics
- live `DEC-021` Decision Drift review
- evidence drawer with retrieved Hindsight memories
- Ask Organizational Memory with Recall and Reflect modes
- decision timeline from proposal through changed constraint
- developer memory setup, seed, and status controls

---

## Tech Stack

### Application

- Next.js
- React
- TypeScript

### Memory / Intelligence

- Hindsight API
- retain / recall / reflect memory operations

### Data

- Supabase
- PostgreSQL
- Row Level Security-ready product schema

---

## Supabase Data Model

The product schema lives at:

```text
supabase/migrations/001_decisiondna_core.sql
```

It includes:

- organizations
- organization membership
- projects
- events
- decisions
- alternatives
- constraints
- evidence
- reviews
- indexes
- timestamps
- initial RLS policies

---

## Local Setup

```bash
git clone https://github.com/navadeep-17/decisionDNA.git
cd decisionDNA
cp .env.example .env.local
npm install
npm run dev
```

Required Hindsight configuration:

```bash
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=hsk_...
HINDSIGHT_BANK_ID=decisiondna-novapay
```

Supabase configuration:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The service-role key must remain server-side and must never be committed.

Open:

```text
http://localhost:3000
```

---

## CLI Memory Proof

The standalone Hindsight proof can still be run with:

```bash
HINDSIGHT_API_KEY=hsk_... npm run memory:demo
```

It demonstrates the retain → recall → reflect → Decision Drift loop independently from the main UI.

---

## Current Status

Implemented:

- Hindsight memory bank integration
- organizational event retention
- evidence recall
- cross-memory reflection
- Decision Drift detection
- DecisionDNA dashboard
- evidence drawer
- organizational-memory queries
- decision timeline
- Supabase product schema

Next product step:

- persist NovaPay events, decisions, constraints, and reviews fully in Supabase
- replace remaining static dashboard metadata with server-backed records
- keep Hindsight as the intelligence and memory layer

---

## Design Principle

> **Memory provides context. Evidence supports review. Humans retain authority over the decision.**

DecisionDNA is designed to make organizational reasoning inspectable over time — especially when yesterday's assumptions stop being true.
