"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./pattern-intelligence.module.css";

type EvidenceItem = { rank: number; text: string; type?: string };
type Pattern = {
  name: string;
  type: "RECURRING" | "EMERGING" | "LESSON";
  signal: string;
  whyItMatters: string;
  watchFor: string;
  evidenceRanks: number[];
  evidence: EvidenceItem[];
};
type Response = {
  ok?: boolean;
  summary?: string;
  patterns?: Pattern[];
  evidenceCount?: number;
  memoryTotal?: number;
  error?: string;
};

export default function PatternIntelligence() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Response | null>(null);

  async function generate() {
    setOpen(true);
    setBusy(true);
    setData(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before generating insights.");

      const response = await fetch("/api/hindsight/patterns", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as Response;
      if (!response.ok) throw new Error(payload.error || "Pattern analysis failed");
      setData(payload);
    } catch (error) {
      setData({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={styles.launcher} type="button" onClick={() => (data ? setOpen(true) : void generate())}>
        <span>✦</span>
        <span><strong>{busy ? "Learning patterns…" : "Org intelligence"}</strong><small>What has NovaPay learned?</small></span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.header}>
              <div><p>ORGANIZATIONAL PATTERN INTELLIGENCE</p><h2>What has NovaPay learned?</h2></div>
              <button type="button" onClick={() => setOpen(false)}>×</button>
            </header>

            {busy ? (
              <div className={styles.loading}><span /><div><strong>Connecting decisions across time…</strong><p>Hindsight is recalling evidence and reflecting on higher-order organizational learning.</p></div></div>
            ) : null}

            {!busy && data?.ok ? (
              <>
                <div className={styles.summary}><span>EXECUTIVE MEMORY SUMMARY</span><p>{data.summary}</p><small>{data.evidenceCount ?? 0} memories analyzed · {data.memoryTotal ?? 0} total memories</small></div>
                <div className={styles.grid}>
                  {(data.patterns || []).map((pattern, index) => (
                    <article key={`${pattern.name}-${index}`} className={styles.card}>
                      <div className={styles.topline}><span className={`${styles.badge} ${styles[pattern.type]}`}>{pattern.type}</span><span>{pattern.evidenceRanks.length} linked memories</span></div>
                      <h3>{pattern.name}</h3>
                      <div className={styles.block}><span>SIGNAL</span><p>{pattern.signal}</p></div>
                      <div className={styles.block}><span>WHY IT MATTERS</span><p>{pattern.whyItMatters}</p></div>
                      <div className={styles.block}><span>WATCH FOR</span><p>{pattern.watchFor}</p></div>
                      {pattern.evidence.length ? <details><summary>Inspect supporting memories</summary><div className={styles.evidence}>{pattern.evidence.map((item) => <div key={item.rank}><span>{String(item.rank).padStart(2,"0")}</span><p>{item.text}</p></div>)}</div></details> : null}
                    </article>
                  ))}
                </div>
                <footer className={styles.footer}><span>Patterns are evidence-backed organizational learning, not autonomous decisions.</span><button type="button" onClick={() => void generate()}>Refresh insights</button></footer>
              </>
            ) : null}

            {!busy && data && !data.ok ? <div className={styles.error}><strong>Could not generate organizational insights</strong><p>{data.error}</p><button type="button" onClick={() => void generate()}>Retry</button></div> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
