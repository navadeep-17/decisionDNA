"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./decision-shockwave.module.css";

type ImpactType = "DECISION" | "ASSUMPTION" | "LESSON";
type Severity = "HIGH" | "MEDIUM" | "LOW";

type Evidence = {
  rank: number;
  text: string;
  type?: string;
};

type Impact = {
  id: string;
  type: ImpactType;
  label: string;
  severity: Severity;
  relationship: string;
  why: string;
  evidence: Evidence[];
};

type ShockwaveResponse = {
  ok?: boolean;
  event?: {
    id: string;
    externalId?: string | null;
    title: string;
    type: string;
    date: string;
    content: string;
  };
  summary?: string;
  humanAction?: string;
  intensity?: number;
  counts?: {
    decisions: number;
    assumptions: number;
    lessons: number;
    highSeverity: number;
  };
  impacts?: Impact[];
  evidenceCount?: number;
  error?: string;
};

function label(value: string) {
  return value.replaceAll("_", " ");
}

export default function DecisionShockwave() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ShockwaveResponse | null>(null);
  const [selected, setSelected] = useState<Impact | null>(null);

  async function runShockwave() {
    setOpen(true);
    setBusy(true);
    setData(null);
    setSelected(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before tracing a memory shockwave.");

      const response = await fetch("/api/hindsight/shockwave", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json()) as ShockwaveResponse;
      if (!response.ok) throw new Error(payload.error || "Shockwave analysis failed");
      setData(payload);
      setSelected(payload.impacts?.[0] || null);
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
        className={styles.launcher}
        type="button"
        onClick={() => (data ? setOpen(true) : void runShockwave())}
      >
        <span className={styles.icon}>⌁</span>
        <span>
          <strong>{busy ? "Tracing impact…" : "Decision shockwave"}</strong>
          <small>Memory → downstream impact graph</small>
        </span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.header}>
              <div>
                <p>ORGANIZATIONAL IMPACT GRAPH</p>
                <h2>Decision Shockwave</h2>
                <span>See how one new memory propagates through decisions, assumptions, and lessons.</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Decision Shockwave">×</button>
            </header>

            {busy ? (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                <div>
                  <strong>Tracing downstream organizational impact…</strong>
                  <p>Hindsight is connecting the latest event to existing decision knowledge.</p>
                </div>
              </div>
            ) : null}

            {!busy && data?.ok ? (
              <>
                <section className={styles.summaryStrip}>
                  <div>
                    <span>LATEST MEMORY SHOCKWAVE</span>
                    <p>{data.summary}</p>
                  </div>
                  <div className={styles.intensity}>
                    <strong>{data.intensity ?? 0}</strong>
                    <small>impact intensity / 100</small>
                  </div>
                </section>

                <div className={styles.metrics}>
                  <article><span>Decisions affected</span><strong>{data.counts?.decisions ?? 0}</strong></article>
                  <article><span>Assumptions shifted</span><strong>{data.counts?.assumptions ?? 0}</strong></article>
                  <article><span>Lessons updated</span><strong>{data.counts?.lessons ?? 0}</strong></article>
                  <article className={styles.highMetric}><span>High-severity nodes</span><strong>{data.counts?.highSeverity ?? 0}</strong></article>
                </div>

                <div className={styles.graphShell}>
                  <div className={styles.ringOne} />
                  <div className={styles.ringTwo} />
                  <div className={styles.ringThree} />

                  <article className={styles.centerNode}>
                    <span>NEW MEMORY</span>
                    <strong>{data.event?.externalId ? `${data.event.externalId} · ` : ""}{data.event?.title}</strong>
                    <small>{data.event?.type?.replaceAll("_", " ")}</small>
                  </article>

                  <div className={styles.orbit}>
                    {(data.impacts || []).slice(0, 8).map((impact, index) => (
                      <button
                        type="button"
                        className={`${styles.impactNode} ${styles[impact.type]} ${styles[`severity${impact.severity}`]}`}
                        key={impact.id}
                        onClick={() => setSelected(impact)}
                        aria-label={`Inspect ${impact.label}`}
                      >
                        <span>{impact.type}</span>
                        <strong>{impact.label}</strong>
                        <small>{impact.relationship}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.lowerGrid}>
                  <article className={styles.eventCard}>
                    <span>SHOCKWAVE ORIGIN</span>
                    <h3>{data.event?.title}</h3>
                    <p>{data.event?.content}</p>
                    <small>{data.evidenceCount ?? 0} Hindsight evidence units used to trace impact</small>
                  </article>

                  <article className={styles.detailCard}>
                    {selected ? (
                      <>
                        <div className={styles.detailTopline}>
                          <span className={`${styles.badge} ${styles[selected.type]}`}>{selected.type}</span>
                          <span className={`${styles.severityBadge} ${styles[`severity${selected.severity}`]}`}>{selected.severity}</span>
                        </div>
                        <h3>{selected.label}</h3>
                        <div className={styles.relationship}>↳ {selected.relationship}</div>
                        <p>{selected.why}</p>

                        {selected.evidence.length ? (
                          <details>
                            <summary>Inspect linked memories</summary>
                            <div className={styles.evidenceList}>
                              {selected.evidence.slice(0, 4).map((memory) => (
                                <div key={`${selected.id}-${memory.rank}`}>
                                  <span>{String(memory.rank).padStart(2, "0")}</span>
                                  <p>{memory.text}</p>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </>
                    ) : (
                      <div className={styles.emptyDetail}>Select an impact node to inspect its evidence.</div>
                    )}
                  </article>
                </div>

                <footer className={styles.footer}>
                  <div>
                    <span>HUMAN REVIEW TARGET</span>
                    <strong>{data.humanAction}</strong>
                  </div>
                  <button type="button" onClick={() => void runShockwave()}>Recalculate shockwave</button>
                </footer>
              </>
            ) : null}

            {!busy && data && !data.ok ? (
              <div className={styles.errorState}>
                <strong>Decision Shockwave could not complete</strong>
                <p>{data.error}</p>
                <button type="button" onClick={() => void runShockwave()}>Retry</button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
