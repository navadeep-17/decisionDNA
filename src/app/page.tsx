"use client";

import { useState } from "react";

type ApiState = {
  label: string;
  data: unknown;
} | null;

const initialQuestion = "Why did NovaPay stop using Redis for checkout sessions?";

export default function Home() {
  const [query, setQuery] = useState(initialQuestion);
  const [busy, setBusy] = useState<string | null>(null);
  const [output, setOutput] = useState<ApiState>(null);

  async function callApi(label: string, path: string, body?: object) {
    setBusy(label);
    setOutput(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      setOutput({ label, data });
    } catch (error) {
      setOutput({ label, data: { ok: false, error: String(error) } });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="brandRow">
          <span className="mark">D</span>
          <span>DecisionDNA</span>
          <span className="pill">NovaPay demo</span>
        </div>
        <p className="eyebrow">ORGANIZATIONAL DECISION MEMORY</p>
        <h1>Your company remembers what it decided. <span>We remember why.</span></h1>
        <p className="lede">
          Milestone 1 proves the core Hindsight loop: retain history, recall evidence,
          reflect across time, and detect when the reasoning behind an old decision has changed.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <div className="step">01</div>
          <h2>Create memory bank</h2>
          <p>Creates DecisionDNA&apos;s NovaPay bank and configures verbose extraction, temporal retrieval, observations, and the decision-focused memory mission.</p>
          <button disabled={!!busy} onClick={() => callApi("Bank setup", "/api/hindsight/setup")}>{busy === "Bank setup" ? "Creating…" : "Create / update bank"}</button>
        </article>

        <article className="card">
          <div className="step">02</div>
          <h2>Seed Redis history</h2>
          <p>Retains eight dated NovaPay events from initial Redis proposal through INC-142, DEC-021, managed Redis adoption, and later outcomes.</p>
          <button disabled={!!busy} onClick={() => callApi("Seed history", "/api/hindsight/seed")}>{busy === "Seed history" ? "Retaining…" : "Retain 8 memories"}</button>
        </article>

        <article className="card">
          <div className="step">02B</div>
          <h2>Inspect memory bank</h2>
          <p>Shows the exact Hindsight bank ID, extracted memory count, and the first retained memory units. Use this immediately after seeding.</p>
          <button className="secondary" disabled={!!busy} onClick={() => callApi("Bank status", "/api/hindsight/status")}>{busy === "Bank status" ? "Inspecting…" : "Inspect bank"}</button>
        </article>

        <article className="card wide">
          <div className="step">03</div>
          <h2>Ask the organization&apos;s memory</h2>
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={3} />
          <div className="actions">
            <button disabled={!!busy} onClick={() => callApi("Recall", "/api/hindsight/recall", { query })}>{busy === "Recall" ? "Searching…" : "Recall evidence"}</button>
            <button className="secondary" disabled={!!busy} onClick={() => callApi("Reflect", "/api/hindsight/reflect", { query })}>{busy === "Reflect" ? "Reasoning…" : "Reflect on history"}</button>
          </div>
        </article>

        <article className="card drift">
          <div>
            <div className="step warning">04</div>
            <h2>Decision Drift</h2>
            <p>Tests our hackathon moment: can the agent notice that managed Redis removed the main operational constraint behind DEC-021 without autonomously changing the architecture?</p>
          </div>
          <button disabled={!!busy} onClick={() => callApi("Decision drift", "/api/hindsight/drift")}>{busy === "Decision drift" ? "Reviewing…" : "Review DEC-021"}</button>
        </article>
      </section>

      <section className="output">
        <div className="outputHeader">
          <span>LIVE RESULT</span>
          <span>{output?.label || "Run a step above"}</span>
        </div>
        <pre>{output ? JSON.stringify(output.data, null, 2) : "Waiting for Hindsight…"}</pre>
      </section>
    </main>
  );
}
