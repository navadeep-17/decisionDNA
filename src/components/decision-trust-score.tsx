"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./decision-trust-score.module.css";

type Evidence = {
  rank: number;
  text: string;
  type?: string;
};

type Dimension = {
  score: number;
  reason: string;
};

type TrustResponse = {
  ok?: boolean;
  decision?: {
    key: string;
    title: string;
    date: string;
    status: string;
  };
  trustScore?: number;
  band?: "STRONG" | "MODERATE" | "FRAGILE";
  dimensions?: {
    evidenceSupport: Dimension;
    outcomeValidation: Dimension;
    contradictionPressure: Dimension;
    consistency: Dimension;
    freshness: Dimension;
  };
  summary?: string;
  humanAction?: string;
  evidenceCount?: number;
  evidence?: Evidence[];
  error?: string;
};

type Props = {
  decisionKey: string;
};

function DimensionRow({ label, value, reason, danger = false }: { label: string; value: number; reason: string; danger?: boolean }) {
  return (
    <div className={styles.dimension}>
      <div className={styles.dimensionTop}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${danger ? styles.dangerFill : ""}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <p>{reason}</p>
    </div>
  );
}

export default function DecisionTrustScore({ decisionKey }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<TrustResponse | null>(null);

  async function calculate() {
    setOpen(true);
    setBusy(true);
    setData(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before calculating decision trust.");

      const response = await fetch("/api/hindsight/trust-score", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ decisionKey }),
      });

      const payload = (await response.json()) as TrustResponse;
      if (!response.ok) throw new Error(payload.error || "Trust score calculation failed");
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

  const score = data?.trustScore ?? null;
  const band = data?.band ?? null;

  return (
    <>
      <button
        className={styles.launcher}
        type="button"
        onClick={() => (data ? setOpen(true) : void calculate())}
      >
        <span className={styles.icon}>{score ?? "◎"}</span>
        <span>
          <strong>{busy ? "Calculating trust…" : score !== null ? `${score}/100 · ${band}` : "Memory trust score"}</strong>
          <small>Evidence quality for {decisionKey}</small>
        </span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.header}>
              <div>
                <p>EVIDENCE QUALITY LAYER</p>
                <h2>Decision Memory Trust</h2>
                <span>How trustworthy is the rationale behind this decision today?</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close trust score">×</button>
            </header>

            {busy ? (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                <div>
                  <strong>Scoring decision evidence…</strong>
                  <p>Hindsight is comparing support, outcomes, contradiction pressure, and freshness.</p>
                </div>
              </div>
            ) : null}

            {!busy && data?.ok && data.dimensions ? (
              <>
                <section className={styles.heroScore}>
                  <div className={`${styles.scoreRing} ${styles[data.band || "MODERATE"]}`}>
                    <strong>{data.trustScore}</strong>
                    <span>/100</span>
                  </div>
                  <div className={styles.scoreCopy}>
                    <span className={`${styles.band} ${styles[data.band || "MODERATE"]}`}>{data.band} TRUST</span>
                    <h3>{data.decision?.key} · {data.decision?.title}</h3>
                    <p>{data.summary}</p>
                    <small>{data.evidenceCount ?? 0} Hindsight memories evaluated</small>
                  </div>
                </section>

                <section className={styles.dimensionGrid}>
                  <DimensionRow
                    label="Evidence support"
                    value={data.dimensions.evidenceSupport.score}
                    reason={data.dimensions.evidenceSupport.reason}
                  />
                  <DimensionRow
                    label="Outcome validation"
                    value={data.dimensions.outcomeValidation.score}
                    reason={data.dimensions.outcomeValidation.reason}
                  />
                  <DimensionRow
                    label="Consistency"
                    value={data.dimensions.consistency.score}
                    reason={data.dimensions.consistency.reason}
                  />
                  <DimensionRow
                    label="Freshness"
                    value={data.dimensions.freshness.score}
                    reason={data.dimensions.freshness.reason}
                  />
                  <DimensionRow
                    label="Contradiction pressure"
                    value={data.dimensions.contradictionPressure.score}
                    reason={data.dimensions.contradictionPressure.reason}
                    danger
                  />
                </section>

                <article className={styles.formulaCard}>
                  <span>HOW THE SCORE IS CALCULATED</span>
                  <div>
                    <strong>30%</strong><small>Evidence support</small>
                    <strong>30%</strong><small>Outcome validation</small>
                    <strong>25%</strong><small>Consistency</small>
                    <strong>15%</strong><small>Freshness</small>
                  </div>
                  <p>Consistency is derived as 100 minus contradiction pressure. Memory volume alone never raises the score.</p>
                </article>

                {data.evidence?.length ? (
                  <details className={styles.evidenceDrawer}>
                    <summary>Inspect the evidence behind this score</summary>
                    <div className={styles.evidenceList}>
                      {data.evidence.slice(0, 8).map((memory) => (
                        <div key={memory.rank}>
                          <span>{String(memory.rank).padStart(2, "0")}</span>
                          <p>{memory.text}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                <footer className={styles.footer}>
                  <div>
                    <span>HUMAN REVIEW ACTION</span>
                    <strong>{data.humanAction}</strong>
                  </div>
                  <button type="button" onClick={() => void calculate()}>Recalculate</button>
                </footer>
              </>
            ) : null}

            {!busy && data && !data.ok ? (
              <div className={styles.errorState}>
                <strong>Trust score could not be calculated</strong>
                <p>{data.error}</p>
                <button type="button" onClick={() => void calculate()}>Retry</button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
