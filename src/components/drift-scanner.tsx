"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./drift-scanner.module.css";

type ScanStatus =
  | "STILL_VALID"
  | "REVIEW_SUGGESTED"
  | "SUPERSEDED"
  | "INSUFFICIENT_EVIDENCE";

type ScanEvidence = {
  rank: number;
  text: string;
  type?: string;
};

type ScanResult = {
  decisionId: string;
  decisionKey: string;
  title: string;
  currentDatabaseStatus: string;
  scanStatus: ScanStatus;
  summary: string;
  evidenceCount: number;
  evidence: ScanEvidence[];
};

type ScanResponse = {
  ok?: boolean;
  scanned?: number;
  counts?: Record<ScanStatus, number>;
  results?: ScanResult[];
  error?: string;
};

function statusLabel(status: ScanStatus) {
  return status.replaceAll("_", " ");
}

export default function DriftScanner() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ScanResponse | null>(null);

  async function scan() {
    setBusy(true);
    setOpen(true);
    setData(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before scanning decisions.");

      const response = await fetch("/api/hindsight/scan", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as ScanResponse;
      if (!response.ok) throw new Error(payload.error || "Decision scan failed");
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

  const reviewCount = data?.counts?.REVIEW_SUGGESTED ?? 0;
  const supersededCount = data?.counts?.SUPERSEDED ?? 0;
  const validCount = data?.counts?.STILL_VALID ?? 0;

  return (
    <>
      <button
        className={styles.launcher}
        type="button"
        onClick={() => (data ? setOpen(true) : void scan())}
      >
        <span className={styles.launcherPulse} />
        <span>
          <strong>{busy ? "Scanning decisions…" : "Scan decision drift"}</strong>
          <small>Autonomous portfolio review</small>
        </span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <aside className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.header}>
              <div>
                <p>AUTOMATIC DECISION DRIFT SCAN</p>
                <h2>Decision health across NovaPay</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close scanner">
                ×
              </button>
            </div>

            <div className={styles.explainer}>
              DecisionDNA compares every tracked decision with later organizational memory, looking for changed assumptions, contradictory outcomes, or explicit replacement decisions.
            </div>

            {busy ? (
              <div className={styles.loadingState}>
                <span className={styles.spinner} />
                <div>
                  <strong>Reasoning across organizational history…</strong>
                  <p>Hindsight is recalling evidence and evaluating each decision independently.</p>
                </div>
              </div>
            ) : null}

            {!busy && data?.ok ? (
              <>
                <div className={styles.summaryGrid}>
                  <article>
                    <span>Scanned</span>
                    <strong>{data.scanned ?? 0}</strong>
                  </article>
                  <article className={styles.reviewMetric}>
                    <span>Review suggested</span>
                    <strong>{reviewCount}</strong>
                  </article>
                  <article>
                    <span>Still valid</span>
                    <strong>{validCount}</strong>
                  </article>
                  <article>
                    <span>Superseded</span>
                    <strong>{supersededCount}</strong>
                  </article>
                </div>

                <div className={styles.results}>
                  {(data.results || []).map((result) => (
                    <article className={styles.resultCard} key={result.decisionId}>
                      <div className={styles.resultTopline}>
                        <span className={`${styles.status} ${styles[result.scanStatus]}`}>
                          {statusLabel(result.scanStatus)}
                        </span>
                        <span>{result.evidenceCount} evidence memories</span>
                      </div>
                      <h3>{result.decisionKey} · {result.title}</h3>
                      <p>{result.summary}</p>

                      {result.evidence?.length ? (
                        <details>
                          <summary>Inspect evidence</summary>
                          <div className={styles.evidenceList}>
                            {result.evidence.slice(0, 4).map((item) => (
                              <div key={`${result.decisionId}-${item.rank}`}>
                                <span>{String(item.rank).padStart(2, "0")}</span>
                                <p>{item.text}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}

                      {result.scanStatus === "REVIEW_SUGGESTED" ? (
                        <button
                          className={styles.reviewButton}
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            setTimeout(
                              () => document.getElementById("decisions")?.scrollIntoView({ behavior: "smooth" }),
                              80,
                            );
                          }}
                        >
                          Open human review →
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>

                <div className={styles.footer}>
                  <span>DecisionDNA never changes architecture automatically.</span>
                  <button type="button" onClick={() => void scan()}>Scan again</button>
                </div>
              </>
            ) : null}

            {!busy && data && !data.ok ? (
              <div className={styles.errorState}>
                <strong>Scan could not complete</strong>
                <p>{data.error}</p>
                <button type="button" onClick={() => void scan()}>Retry</button>
              </div>
            ) : null}

            {!busy && !data ? (
              <div className={styles.emptyState}>
                <strong>Ready to scan organizational decisions</strong>
                <p>Run the scanner after adding new evidence to see whether any historical assumptions have drifted.</p>
                <button type="button" onClick={() => void scan()}>Scan all decisions</button>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
