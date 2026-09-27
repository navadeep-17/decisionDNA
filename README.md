# DecisionDNA

DecisionDNA is a Hindsight-powered organizational memory agent that remembers what a company decided, why it decided it, what happened afterward, and when the assumptions behind an old decision may have changed.

## Milestone 1

This repository currently proves the core memory loop using a synthetic fintech company called NovaPay:

1. Create and configure a Hindsight memory bank.
2. Retain eight dated events around a Redis architecture decision.
3. Recall the evidence behind NovaPay's decision to stop using Redis for checkout sessions.
4. Reflect across later organizational history.
5. Detect **Decision Drift** when managed Redis removes the operational constraint that originally drove DEC-021.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Add a Hindsight Cloud key to `.env.local`:

```bash
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=hsk_...
HINDSIGHT_BANK_ID=decisiondna-novapay
```

Then open `http://localhost:3000` and run the four milestone steps in order.

## CLI proof

You can also run the memory proof without the UI:

```bash
HINDSIGHT_API_KEY=hsk_... npm run memory:demo
```

## Architecture boundary

Hindsight owns semantic/temporal organizational memory and cross-memory reasoning. Application state and product records will be added in Supabase in the next phase; we intentionally do not recreate the memory engine in Postgres/pgvector.
