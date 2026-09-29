"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./decision-contract.module.css";

type TermType = "assumption" | "success_criterion" | "reversal_condition";
type EvaluationStatus =
  | "HOLDS"
  | "WEAKENED"
  | "INVALIDATED"
  | "VALIDATED"
  | "AT_RISK"
  | "MET"
  | "POSSIBLY_MET"
  | "NOT_MET"
  | "UNKNOWN";

type ContractState =
  | "VALID"
  | "AT_RISK"
  | "PARTIAL_TRIGGER"
  | "REVIEW_TRIGGERED"
  | "INSUFFICIENT_EVIDENCE";

type Evidence = {
  rank: number;
  text: string;
  type?: string;
};

type Evaluation = {
  key: string;
  type: TermType;
  text: string;
  baselineStatus: string;
  status: EvaluationStatus;
  current: string;
  why: string;
  evidenceRanks: number[];
  evidence: Evidence[];
};

type ContractResponse = {
  ok?: boolean;
  decision?: {
    key: string;
    title: string;
    date: string;
    decision: string;
    rationale?: string | null;
    status: string;
  };
  contractState?: ContractState;
  summary?: string;
  humanAction?: string;
  termCount?: number;
  reversalConditionCount?: number;
  triggeredCount?: number;
  possibleTriggerCount?: number;
  evaluations?: Evaluation[];
  evidenceCount?: number;
  error?: string;
};

type Props = { decisionKey: string };

function label(value: string) {
  return value.replaceAll("_", " ");
}

function sectionTitle(type: TermType) {
  if (type === "assumption") return "Original assumptions";
  if (type === "success_criterion") return "Success criteria";
  return "Change-our-mind conditions";
}

function sectionHint(type: TermType) {
  if (type === "assumption") return "What had to be true when the decision was made";
  if (type === "success_criterion") return "How the decision was expected to prove itself";
  return "Conditions defined in advance that justify reconsideration";
}

export default function DecisionContract({ decisionKey }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ContractResponse | null>(null);

  async function evaluateContract() {
    setOpen(true);
    setBusy(true);
    setData(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before evaluating the decision contract.");

      const response = await fetch("/api/hindsight/contract-check", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ decisionKey }),
      });

      const payload = (await response.json()) as ContractResponse;
      if (!response.ok) throw new Error(payload.error || "Decision Contract evaluation failed");
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

  const groups: TermType[] = ["assumption", "success_criterion", "reversal_condition"];
  const state = data?.contractState || "INSUFFICIENT_EVIDENCE";

  return (
    <>
      <button
        className={styles.launcher}
        type="button"
        onClick={() => (data ? setOpen(true) : void evaluateContract())}
      >
        <span className={styles.icon}>§</span>
        <span>
          <strong>{busy ? "Checking contract…" : "Decision contract"}</strong>
          <small>What would change our mind?</small>
        </span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.header}>
              <div>
                <p>PRE-COMMITTED REVIEW CRITERIA</p>
                <h2>
                  {data?.decision
                    ? `${data.decision.key} · ${data.decision.title}`
                    : `Decision Contract · ${decisionKey}`}
                </h2>
                <span>The organization defined what would validate this decision — and what would justify reopening it.</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Decision Contract">×</button>
            </header>

            {busy ? (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                <div>
                  <strong>Evaluating the original contract…</strong>
                  <p>Hindsight is comparing pre-declared assumptions and reversal conditions with current memory.</p>
                </div>
              </div>
            ) : null}

            {!busy && data?.ok ? (
              <>
                <section className={styles.hero}>
                  <div>
                    <span className={`${styles.state} ${styles[state]}`}>{label(state)}</span>
                    <h3>{data.summary}</h3>
                    <p>
                      Unlike ordinary drift detection, these review conditions existed independently of today&apos;s AI analysis.
                    </p>
                  </div>
                  <div className={styles.heroMetrics}>
                    <div><strong>{data.triggeredCount ?? 0}</strong><span>conditions met</span></div>
                    <div><strong>{data.possibleTriggerCount ?? 0}</strong><span>possible triggers</span></div>
                    <div><strong>{data.evidenceCount ?? 0}</strong><span>memories checked</span></div>
                  </div>
                </section>

                <div className={styles.contractGrid}>
                  {groups.map((type) => {
                    const items = (data.evaluations || []).filter((item) => item.type === type);
                    return (
                      <section className={styles.group} key={type}>
                        <div className={styles.groupHeader}>
                          <div>
                            <p>{sectionTitle(type)}</p>
                            <span>{sectionHint(type)}</span>
                          </div>
                          <strong>{items.length}</strong>
                        </div>

                        <div className={styles.termList}>
                          {items.map((item) => (
                            <article
                              className={`${styles.termCard} ${item.status === "MET" ? styles.triggered : ""}`}
                              key={item.key}
                            >
                              <div className={styles.termTopline}>
                                <span className={styles.termKey}>{item.key}</span>
                                <span className={`${styles.termStatus} ${styles[item.status]}`}>{label(item.status)}</span>
                              </div>
                              <h4>{item.text}</h4>
                              <div className={styles.termDetail}>
                                <span>CURRENT EVIDENCE</span>
                                <p>{item.current}</p>
                              </div>
                              <div className={styles.termDetail}>
                                <span>WHY</span>
                                <p>{item.why}</p>
                              </div>

                              {item.evidence?.length ? (
                                <details>
                                  <summary>{item.evidence.length} linked memories</summary>
                                  <div className={styles.evidenceList}>
                                    {item.evidence.slice(0, 4).map((memory) => (
                                      <div key={`${item.key}-${memory.rank}`}>
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
                      </section>
                    );
                  })}
                </div>

                <footer className={styles.footer}>
                  <div>
                    <span>HUMAN REVIEW ACTION</span>
                    <strong>{data.humanAction}</strong>
                  </div>
                  <button type="button" onClick={() => void evaluateContract()}>Re-check contract</button>
                </footer>
              </>
            ) : null}

            {!busy && data && !data.ok ? (
              <div className={styles.errorState}>
                <strong>Decision Contract could not be evaluated</strong>
                <p>{data.error}</p>
                <button type="button" onClick={() => void evaluateContract()}>Retry</button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
