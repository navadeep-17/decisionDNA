"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./decision-replay.module.css";

type AssumptionStatus = "ACTIVE" | "WEAKENED" | "INVALIDATED" | "UNKNOWN";

type Evidence = {
  rank: number;
  text: string;
  type?: string;
};

type ReplayResponse = {
  ok?: boolean;
  decision?: {
    key: string;
    title: string;
    date: string;
    rationale?: string | null;
    status?: string;
  };
  then?: {
    eventCount: number;
    summary: string;
  };
  now?: {
    eventCount: number;
    summary: string;
  };
  decisionDelta?: string;
  humanAction?: string;
  assumptions?: Array<{
    assumption: string;
    status: AssumptionStatus;
    then: string;
    now: string;
    delta: string;
    evidenceRanks: number[];
    evidence: Evidence[];
  }>;
  evidenceCount?: number;
  evidence?: Evidence[];
  error?: string;
};

type Props = {
  decisionKey: string;
};

function label(status: AssumptionStatus) {
  return status.replaceAll("_", " ");
}

export default function DecisionReplay({ decisionKey }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ReplayResponse | null>(null);

  async function runReplay() {
    setOpen(true);
    setBusy(true);
    setData(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before replaying a decision.");

      const response = await fetch("/api/hindsight/replay", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ decisionKey }),
      });

      const payload = (await response.json()) as ReplayResponse;
      if (!response.ok) throw new Error(payload.error || "Decision replay failed");
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

  return (
    <>
      <button
        className={styles.replayButton}
        type="button"
        onClick={() => (data ? setOpen(true) : void runReplay())}
      >
        ↺ Replay decision
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.header}>
              <div>
                <p>MEMORY TIME TRAVEL</p>
                <h2>{data?.decision ? `${data.decision.key} · ${data.decision.title}` : `Replay ${decisionKey}`}</h2>
                <span>What did we know then — and what do we know now?</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close replay">×</button>
            </header>

            {busy ? (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                <div>
                  <strong>Reconstructing the decision context…</strong>
                  <p>Hindsight is separating historical evidence from what NovaPay learned later.</p>
                </div>
              </div>
            ) : null}

            {!busy && data?.ok ? (
              <>
                <div className={styles.timeGrid}>
                  <article className={styles.thenCard}>
                    <div className={styles.timeLabel}><span>THEN</span><small>{data.then?.eventCount ?? 0} known events</small></div>
                    <h3>At decision time</h3>
                    <p>{data.then?.summary}</p>
                  </article>

                  <div className={styles.arrow}>→</div>

                  <article className={styles.nowCard}>
                    <div className={styles.timeLabel}><span>NOW</span><small>{data.now?.eventCount ?? 0} later events</small></div>
                    <h3>Current organizational knowledge</h3>
                    <p>{data.now?.summary}</p>
                  </article>
                </div>

                <article className={styles.deltaCard}>
                  <div>
                    <span>DECISION CONTEXT DELTA</span>
                    <h3>{data.decisionDelta}</h3>
                  </div>
                  <div className={styles.deltaMeta}>
                    <strong>{data.evidenceCount ?? 0}</strong>
                    <small>Hindsight memories</small>
                  </div>
                </article>

                <section className={styles.assumptions}>
                  <div className={styles.sectionTitle}>
                    <div>
                      <p>ASSUMPTION LEDGER</p>
                      <h3>What changed underneath the decision?</h3>
                    </div>
                    <span>Evidence-backed</span>
                  </div>

                  {(data.assumptions || []).length ? (
                    <div className={styles.assumptionGrid}>
                      {(data.assumptions || []).map((item, index) => (
                        <article className={styles.assumptionCard} key={`${item.assumption}-${index}`}>
                          <div className={styles.assumptionTopline}>
                            <span className={`${styles.status} ${styles[item.status]}`}>{label(item.status)}</span>
                            <span>{item.evidence.length} linked memories</span>
                          </div>
                          <h4>{item.assumption}</h4>
                          <div className={styles.miniDiff}>
                            <div><span>THEN</span><p>{item.then}</p></div>
                            <div><span>NOW</span><p>{item.now}</p></div>
                          </div>
                          <div className={styles.deltaLine}><span>Δ</span><p>{item.delta}</p></div>

                          {item.evidence.length ? (
                            <details>
                              <summary>Inspect linked memories</summary>
                              <div className={styles.evidenceList}>
                                {item.evidence.slice(0, 4).map((memory) => (
                                  <div key={`${index}-${memory.rank}`}>
                                    <span>{String(memory.rank).padStart(2, "0")}</span>
                                    <p>{memory.text}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyAssumptions}>No distinct assumptions could be grounded from the current evidence.</div>
                  )}
                </section>

                <footer className={styles.footer}>
                  <div>
                    <span>HUMAN REVIEW ACTION</span>
                    <strong>{data.humanAction}</strong>
                  </div>
                  <button type="button" onClick={() => void runReplay()}>Replay again</button>
                </footer>
              </>
            ) : null}

            {!busy && data && !data.ok ? (
              <div className={styles.error}>
                <strong>Replay could not complete</strong>
                <p>{data.error}</p>
                <button type="button" onClick={() => void runReplay()}>Retry</button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
