"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./proposal-guard.module.css";

type Verdict =
  | "WE_HAVE_TRIED_THIS_BEFORE"
  | "RELATED_HISTORY"
  | "NOVEL_PROPOSAL"
  | "INSUFFICIENT_EVIDENCE";

type Evidence = {
  rank: number;
  text: string;
  type?: string;
  score?: number;
};

type ProposalResponse = {
  ok?: boolean;
  proposal?: string;
  verdict?: Verdict;
  headline?: string;
  whatHappened?: string;
  whatChanged?: string;
  watchOut?: string;
  nextStep?: string;
  evidenceCount?: number;
  evidence?: Evidence[];
  error?: string;
};

const DEFAULT_PROPOSAL =
  "Use Redis for checkout sessions to reduce latency during high-traffic campaigns.";

function verdictLabel(verdict?: Verdict) {
  if (!verdict) return "Checking history";
  if (verdict === "WE_HAVE_TRIED_THIS_BEFORE") return "We've tried this before";
  if (verdict === "RELATED_HISTORY") return "Related history found";
  if (verdict === "NOVEL_PROPOSAL") return "No matching history found";
  return "Not enough evidence";
}

export default function ProposalGuard() {
  const [open, setOpen] = useState(false);
  const [proposal, setProposal] = useState(DEFAULT_PROPOSAL);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProposalResponse | null>(null);

  async function checkProposal() {
    setBusy(true);
    setResult(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again before checking a proposal.");

      const response = await fetch("/api/hindsight/proposal-check", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ proposal }),
      });

      const payload = (await response.json()) as ProposalResponse;
      if (!response.ok) throw new Error(payload.error || "Proposal check failed");
      setResult(payload);
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={styles.launcher} type="button" onClick={() => setOpen(true)}>
        <span className={styles.icon}>↺</span>
        <span>
          <strong>Proposal guard</strong>
          <small>Have we tried this before?</small>
        </span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.header}>
              <div>
                <p>ORGANIZATIONAL MEMORY CHECK</p>
                <h2>Have we tried this before?</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close proposal guard">×</button>
            </header>

            <div className={styles.explainer}>
              Before a team repeats an idea, DecisionDNA searches the organization’s remembered decisions, incidents, rejected alternatives, and later outcomes.
            </div>

            <label className={styles.inputLabel}>
              New proposal
              <textarea
                rows={4}
                value={proposal}
                onChange={(event) => setProposal(event.target.value)}
                placeholder="Describe what the team wants to try..."
              />
            </label>

            <div className={styles.actions}>
              <button type="button" onClick={() => setProposal(DEFAULT_PROPOSAL)} className={styles.secondary}>
                Load Redis demo
              </button>
              <button
                type="button"
                onClick={() => void checkProposal()}
                disabled={busy || !proposal.trim()}
                className={styles.primary}
              >
                {busy ? "Searching organizational memory…" : "Check organizational memory"}
              </button>
            </div>

            {busy ? (
              <div className={styles.loading}>
                <span />
                <div>
                  <strong>Looking across remembered history…</strong>
                  <p>Hindsight is recalling related decisions, incidents, and changed assumptions.</p>
                </div>
              </div>
            ) : null}

            {!busy && result?.ok ? (
              <div className={styles.resultWrap}>
                <div className={`${styles.verdict} ${styles[result.verdict || "INSUFFICIENT_EVIDENCE"]}`}>
                  <span>{verdictLabel(result.verdict)}</span>
                  <strong>{result.headline}</strong>
                  <small>{result.evidenceCount ?? 0} organizational memories considered</small>
                </div>

                <div className={styles.insightGrid}>
                  <article>
                    <span>WHAT HAPPENED BEFORE</span>
                    <p>{result.whatHappened || "No prior outcome summarized."}</p>
                  </article>
                  <article>
                    <span>WHAT CHANGED</span>
                    <p>{result.whatChanged || "No changed condition identified."}</p>
                  </article>
                  <article>
                    <span>WATCH OUT</span>
                    <p>{result.watchOut || "No specific historical risk identified."}</p>
                  </article>
                  <article>
                    <span>NEXT STEP</span>
                    <p>{result.nextStep || "Review the evidence before making a new decision."}</p>
                  </article>
                </div>

                {result.evidence?.length ? (
                  <details className={styles.evidence}>
                    <summary>Show supporting memories</summary>
                    <div>
                      {result.evidence.slice(0, 6).map((item) => (
                        <article key={item.rank}>
                          <span>{String(item.rank).padStart(2, "0")}</span>
                          <p>{item.text}</p>
                        </article>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            {!busy && result && !result.ok ? (
              <div className={styles.error}>
                <strong>Proposal check failed</strong>
                <p>{result.error}</p>
                <button type="button" onClick={() => void checkProposal()}>Retry</button>
              </div>
            ) : null}

            <footer className={styles.footer}>
              <span>History is context, not an automatic veto.</span>
              {result?.ok ? <button type="button" onClick={() => void checkProposal()}>Check again</button> : null}
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
