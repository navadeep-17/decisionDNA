"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./knowledge-gap-radar.module.css";

type Readiness = "READY_FOR_HUMAN_REVIEW" | "PARTIAL_EVIDENCE" | "NOT_READY";
type Priority = "HIGH" | "MEDIUM" | "LOW";

type Evidence = { rank: number; text: string; type?: string };
type Known = { statement: string; evidence: Evidence[] };
type Gap = {
  category: string;
  priority: Priority;
  question: string;
  whyItMatters: string;
  howToClose: string;
  relatedEvidence: Evidence[];
};
type Conflict = { issue: string; whyUnresolved: string; evidence: Evidence[] };

type RadarResponse = {
  ok?: boolean;
  proposal?: string;
  readiness?: Readiness;
  summary?: string;
  nextAction?: string;
  known?: Known[];
  gaps?: Gap[];
  conflicts?: Conflict[];
  counts?: { known: number; gaps: number; highPriorityGaps: number; conflicts: number };
  evidenceCount?: number;
  error?: string;
};

function label(value?: string) {
  return value ? value.replaceAll("_", " ") : "—";
}

export default function KnowledgeGapRadar() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState(
    "Move checkout sessions back to managed Redis to reduce latency during high-traffic campaigns.",
  );
  const [data, setData] = useState<RadarResponse | null>(null);

  async function runRadar() {
    setOpen(true);
    setBusy(true);
    setData(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before checking decision readiness.");

      const response = await fetch("/api/hindsight/gaps", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ proposal }),
      });

      const payload = (await response.json()) as RadarResponse;
      if (!response.ok) throw new Error(payload.error || "Knowledge Gap Radar failed");
      setData(payload);
    } catch (error) {
      setData({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={styles.launcher} type="button" onClick={() => setOpen(true)}>
        <span className={styles.icon}>?</span>
        <span>
          <strong>Knowledge gap radar</strong>
          <small>What don't we know yet?</small>
        </span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.header}>
              <div>
                <p>PRE-DECISION INTELLIGENCE</p>
                <h2>Knowledge Gap Radar</h2>
                <span>Know what is missing before the organization commits.</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close knowledge gap radar">×</button>
            </header>

            <section className={styles.proposalBox}>
              <label htmlFor="gap-proposal">Proposal to evaluate</label>
              <textarea
                id="gap-proposal"
                rows={3}
                value={proposal}
                onChange={(event) => setProposal(event.target.value)}
              />
              <div>
                <span>Hindsight checks remembered evidence without filling gaps with guesses.</span>
                <button type="button" disabled={busy || !proposal.trim()} onClick={() => void runRadar()}>
                  {busy ? "Checking evidence…" : "Check decision readiness"}
                </button>
              </div>
            </section>

            {busy ? (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                <div>
                  <strong>Finding what NovaPay knows — and what it doesn't…</strong>
                  <p>Hindsight is separating remembered evidence from unresolved decision gaps.</p>
                </div>
              </div>
            ) : null}

            {!busy && data?.ok ? (
              <>
                <section className={styles.summaryCard}>
                  <div>
                    <span className={`${styles.readiness} ${styles[data.readiness || "PARTIAL_EVIDENCE"]}`}>
                      {label(data.readiness)}
                    </span>
                    <h3>{data.summary}</h3>
                    <p>{data.evidenceCount ?? 0} organizational memories inspected</p>
                  </div>
                  <div className={styles.metrics}>
                    <div><strong>{data.counts?.known ?? 0}</strong><span>known</span></div>
                    <div><strong>{data.counts?.gaps ?? 0}</strong><span>gaps</span></div>
                    <div><strong>{data.counts?.highPriorityGaps ?? 0}</strong><span>high priority</span></div>
                    <div><strong>{data.counts?.conflicts ?? 0}</strong><span>conflicts</span></div>
                  </div>
                </section>

                <section className={styles.knownSection}>
                  <div className={styles.sectionTitle}>
                    <div><p>WHAT WE KNOW</p><h3>Grounded organizational evidence</h3></div>
                  </div>
                  <div className={styles.knownGrid}>
                    {(data.known || []).map((item, index) => (
                      <article key={`${item.statement}-${index}`}>
                        <span>✓</span>
                        <div>
                          <p>{item.statement}</p>
                          {item.evidence.length ? (
                            <details>
                              <summary>{item.evidence.length} linked memories</summary>
                              <div className={styles.evidenceList}>
                                {item.evidence.slice(0, 3).map((memory) => (
                                  <div key={`${index}-${memory.rank}`}><span>{String(memory.rank).padStart(2, "0")}</span><p>{memory.text}</p></div>
                                ))}
                              </div>
                            </details>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={styles.gapSection}>
                  <div className={styles.sectionTitle}>
                    <div><p>WHAT WE DON'T KNOW</p><h3>Evidence required before approval</h3></div>
                    <span>{data.counts?.highPriorityGaps ?? 0} high-priority gaps</span>
                  </div>
                  <div className={styles.gapGrid}>
                    {(data.gaps || []).map((gap, index) => (
                      <article className={`${styles.gapCard} ${styles[`priority${gap.priority}`]}`} key={`${gap.category}-${index}`}>
                        <div className={styles.gapTopline}>
                          <span>{gap.category}</span>
                          <strong>{gap.priority}</strong>
                        </div>
                        <h4>{gap.question}</h4>
                        <div className={styles.gapMeta}><span>WHY IT MATTERS</span><p>{gap.whyItMatters}</p></div>
                        <div className={styles.closeGap}><span>HOW TO CLOSE THE GAP</span><p>{gap.howToClose}</p></div>
                        {gap.relatedEvidence.length ? (
                          <details>
                            <summary>Why this gap is relevant</summary>
                            <div className={styles.evidenceList}>
                              {gap.relatedEvidence.slice(0, 3).map((memory) => (
                                <div key={`gap-${index}-${memory.rank}`}><span>{String(memory.rank).padStart(2, "0")}</span><p>{memory.text}</p></div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>

                {(data.conflicts || []).length ? (
                  <section className={styles.conflictSection}>
                    <div className={styles.sectionTitle}>
                      <div><p>UNRESOLVED EVIDENCE</p><h3>What current memory still disagrees about</h3></div>
                    </div>
                    <div className={styles.conflictGrid}>
                      {(data.conflicts || []).map((conflict, index) => (
                        <article key={`${conflict.issue}-${index}`}>
                          <span>≠</span>
                          <div><h4>{conflict.issue}</h4><p>{conflict.whyUnresolved}</p></div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                <footer className={styles.footer}>
                  <div><span>NEXT EVIDENCE TO COLLECT</span><strong>{data.nextAction}</strong></div>
                  <button type="button" onClick={() => void runRadar()}>Refresh radar</button>
                </footer>
              </>
            ) : null}

            {!busy && data && !data.ok ? (
              <div className={styles.errorState}>
                <strong>Knowledge Gap Radar could not complete</strong>
                <p>{data.error}</p>
                <button type="button" onClick={() => void runRadar()}>Retry</button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
