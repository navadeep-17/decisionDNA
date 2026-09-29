# DecisionDNA

DecisionDNA is a Hindsight-powered organizational decision-memory product that remembers what a company decided, why it decided it, what happened afterward, and when the assumptions behind an old decision may have changed.

## Current state

The project has completed the core Hindsight proof and now includes the first real product dashboard.

### Working memory loop

Using a synthetic fintech company called NovaPay, DecisionDNA can:

1. Create and configure a Hindsight memory bank.
2. Retain dated organizational events around an architecture decision.
3. Recall evidence behind previous decisions and incidents.
4. Reflect across later organizational history.
5. Detect **Decision Drift** when a later event invalidates an original constraint.
6. Expose the supporting Hindsight evidence used for the review.

The current demo centers on `DEC-021`, where NovaPay stopped using self-managed Redis for checkout sessions after `INC-142`. Later adoption of managed Redis removes the operational constraint that originally drove the decision, causing DecisionDNA to return `REVIEW_SUGGESTED` rather than automatically changing the architecture.

## Product UI

The main dashboard now includes:

- organizational memory health
- decision-health metrics
- live DEC-021 Decision Drift review
- evidence drawer showing retrieved Hindsight memories
- Ask Organizational Memory with Recall and Reflect modes
- decision timeline from proposal through changed constraint
- developer-only memory setup/seed/status controls

## Architecture

```text
Organizational events
        |
        v
Hindsight retain()
        |
        v
Persistent organizational memory
        |
        +---- recall() ---> evidence
        |
        +---- reflect() --> cross-memory reasoning
        |
        v
DecisionDNA product layer
        |
        +---- decision health
        +---- decision drift
        +---- timeline
        +---- evidence/audit trail
```

### Responsibility boundary

**Hindsight owns:**

- semantic and temporal organizational memory
- fact/entity/relationship extraction
- retrieval
- observations
- cross-memory reasoning

**Supabase owns:**

- users and organizations
- projects
- source events
- product-facing decision records
- constraints and alternatives
- evidence links
- review workflow state

We intentionally do not recreate Hindsight with pgvector.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Required Hindsight variables:

```bash
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=hsk_...
HINDSIGHT_BANK_ID=decisiondna-novapay
```

Then open:

```text
http://localhost:3000
```

If the NovaPay bank is already seeded, the dashboard automatically reads its memory count and the live review can be run immediately.

## Supabase phase

The product schema is ready at:

```text
supabase/migrations/001_decisiondna_core.sql
```

It includes organizations, membership, projects, events, decisions, alternatives, constraints, evidence, reviews, indexes, timestamps, and initial RLS policies.

When connecting a Supabase project, add:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The service-role key must remain server-side and must never be committed.

## CLI memory proof

The original standalone proof remains available:

```bash
HINDSIGHT_API_KEY=hsk_... npm run memory:demo
```

## Next implementation step

Connect Supabase to the prepared schema, persist NovaPay's events/decisions/reviews in the product database, and replace the remaining static dashboard metadata with server-backed records while keeping Hindsight as the intelligence layer.
