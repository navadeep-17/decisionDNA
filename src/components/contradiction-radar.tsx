"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./contradiction-radar.module.css";

type Classification =
  | "TRUE_CONTRADICTION"
  | "DECISION_EVOLUTION"
  | "STALE_ASSUMPTION"
  | "RESOLVED";

type Severity = "HIGH" | "MEDIUM" | "LOW";

type Evidence = {
  rank: number;
  text: string;
  type?: string;
};

type Conflict = {
  title: string;
  classification: Classification;
  severity: Severity;
  claimA: string;
  claimAEvidence: Evidence[];
  claimB: string;
  claimBEvidence: Evidence[];
  explanation: string;
  currentInterpretation: string;
  humanAction: string;
};

type RadarResponse = {
  ok?: boolean;
  memoryTotal?: number;
  summary?: string;
  counts?: Record<Classification, number>;
  conflicts?: Conflict[];
  evidenceCount?: number;
  error?: string;
};

function label(value: string) {
  return value.replaceAll("_", " ");
}

export default function ContradictionRadar() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<RadarResponse | null>(null);

  async function runRadar() {
    setOpen(true);
    setBusy(true);
    setData(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before checking memory consistency.");

      const response = await fetch("/api/hindsight/contradictions", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as RadarResponse;
      if (!response.ok) throw new Error(payload.error || "Contradiction scan failed");
      setData(payload);
    } catch (error) {
      setData({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  }

  const trueContradictions = data?.counts?.TRUE_CONTRADICTION ?? 0;
  const stale = data?.counts?.STALE_ASSUMPTION ?? 0;
  const evolution = data?.counts?.DECISION_EVOLUTION ?? 0;
  const resolved = data?.counts?.RESOLVED ?? 0;

  return (
    <>
      <button
        className={styles.launcher}
        type="button"
        onClick={() => (data ? setOpen(true) : void runRadar())}
      >
        <span className={styles.icon}>≠</span>
        <span>
          <strong>{busy ? "Checking memory…" : "Contradiction radar"}</strong>
          <small>Memory consistency + evolution</small>
        </span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.header}>
              <div>
                <p>MEMORY QUALITY LAYER</p>
                <h2>Contradiction Radar</h2>
                <span>Distinguish bad memory conflicts from legitimate decision evolution.</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close contradiction radar">×</button>
            </header>

            {busy ? (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                <div>
                  <strong>Cross-checking organizational memory…</strong>
                  <p>Hindsight is comparing claims across decisions, incidents, constraints, and later outcomes.</p>
                </div>
              </div>
            ) : null}

            {!busy && data?.ok ? (
              <>
                <article className={styles.summaryCard}>
                  <div>
                    <span>RADAR SUMMARY</span>
                    <p>{data.summary}</p>
                  </div>
                  <div className={styles.memoryMetric}>
                    <strong>{data.memoryTotal ?? "—"}</strong>
                    <small>memories checked</small>
                  </div>
                </article>

                <div className={styles.metrics}>
                  <article className={styles.dangerMetric}><span>True contradictions</span><strong>{trueContradictions}</strong></article>
                  <article><span>Decision evolution</span><strong>{evolution}</strong></article>
                  <article className={styles.warningMetric}><span>Stale assumptions</span><strong>{stale}</strong></article>
                  <article><span>Resolved</span><strong>{resolved}</strong></article>
                </div>

                {(data.conflicts || []).length ? (
                  <div className={styles.conflictList}>
                    {(data.conflicts || []).map((conflict, index) => (
                      <article className={styles.conflictCard} key={`${conflict.title}-${index}`}>
                        <div className={styles.topline}>
                          <div>
                            <span className={`${styles.classification} ${styles[conflict.classification]}`}>
                              {label(conflict.classification)}
                            </span>
                            <span className={`${styles.severity} ${styles[`severity${conflict.severity}`]}`}>
                              {conflict.severity}
                            </span>
                          </div>
                          <small>Case {String(index + 1).padStart(2, "0")}</small>
                        </div>

                        <h3>{conflict.title}</h3>

                        <div className={styles.claimGrid}>
                          <section>
                            <span>CLAIM A</span>
                            <p>{conflict.claimA}</p>
                            {conflict.claimAEvidence.length ? (
                              <details>
                                <summary>{conflict.claimAEvidence.length} linked memories</summary>
                                <div className={styles.evidenceList}>
                                  {conflict.claimAEvidence.slice(0, 3).map((memory) => (
                                    <div key={`a-${index}-${memory.rank}`}>
                                      <span>{String(memory.rank).padStart(2, "0")}</span>
                                      <p>{memory.text}</p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            ) : null}
                          </section>

                          <div className={styles.versus}>VS</div>

                          <section>
                            <span>CLAIM B</span>
                            <p>{conflict.claimB}</p>
                            {conflict.claimBEvidence.length ? (
                              <details>
                                <summary>{conflict.claimBEvidence.length} linked memories</summary>
                                <div className={styles.evidenceList}>
                                  {conflict.claimBEvidence.slice(0, 3).map((memory) => (
                                    <div key={`b-${index}-${memory.rank}`}>
                                      <span>{String(memory.rank).padStart(2, "0")}</span>
                                      <p>{memory.text}</p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            ) : null}
                          </section>
                        </div>

                        <div className={styles.explanation}>
                          <div><span>WHY THEY DIFFER</span><p>{conflict.explanation}</p></div>
                          <div className={styles.current}><span>CURRENT INTERPRETATION</span><p>{conflict.currentInterpretation}</p></div>
                        </div>

                        <div className={styles.humanAction}>
                          <span>HUMAN ACTION</span>
                          <strong>{conflict.humanAction}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.cleanState}>
                    <span>✓</span>
                    <div>
                      <strong>No material memory conflicts found</strong>
                      <p>Current recalled evidence is internally consistent or too weak to justify a contradiction case.</p>
                    </div>
                  </div>
                )}

                <footer className={styles.footer}>
                  <span>{data.evidenceCount ?? 0} Hindsight evidence units compared</span>
                  <button type="button" onClick={() => void runRadar()}>Run radar again</button>
                </footer>
              </>
            ) : null}

            {!busy && data && !data.ok ? (
              <div className={styles.errorState}>
                <strong>Contradiction Radar could not complete</strong>
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
