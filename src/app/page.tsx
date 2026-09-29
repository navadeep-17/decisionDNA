"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type EventRow = {
  id: string;
  external_id: string | null;
  event_type: string;
  title: string;
  content: string;
  event_date: string;
};

type DecisionRow = {
  id: string;
  decision_key: string;
  title: string;
  summary: string | null;
  decision: string;
  rationale: string | null;
  status: string;
  confidence: number | null;
  decision_date: string;
};

type RecallItem = {
  text?: string;
  type?: string;
  fact_type?: string;
};

type RecallResponse = {
  ok?: boolean;
  results?: RecallItem[];
  result?: { results?: RecallItem[] };
  error?: string;
};

type ReflectResponse = {
  ok?: boolean;
  result?: { text?: string };
  text?: string;
  error?: string;
};

type DriftEvidence = {
  rank?: number;
  text?: string;
  type?: string;
};

type DriftResponse = {
  ok?: boolean;
  bankId?: string;
  memoryTotal?: number;
  evidenceCount?: number;
  evidence?: DriftEvidence[];
  result?: { text?: string };
  error?: string;
};

type BankStatus = {
  ok?: boolean;
  bankId?: string;
  total?: number;
};

type ApiState = {
  label: string;
  data: RecallResponse | ReflectResponse;
} | null;

const suggestedQuestions = [
  "Why did NovaPay stop using Redis for checkout sessions?",
  "What changed after DEC-021?",
  "Which assumptions behind DEC-021 no longer hold?",
  "What repeatedly contributed to INC-142?",
];

function formatAnswer(value?: string) {
  if (!value) return "No answer returned.";
  return value
    .replace(/^#{1,4}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^\*\s+/gm, "• ");
}

function prettyDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function eventLabel(event: EventRow) {
  return event.external_id ? `${event.external_id} · ${event.title}` : event.title;
}

export default function Home() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [query, setQuery] = useState(suggestedQuestions[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [memoryTotal, setMemoryTotal] = useState<number | null>(null);
  const [bankId, setBankId] = useState("decisiondna-novapay");
  const [askResult, setAskResult] = useState<ApiState>(null);
  const [drift, setDrift] = useState<DriftResponse | null>(null);

  const dec021 = useMemo(
    () => decisions.find((decision) => decision.decision_key === "DEC-021") ?? null,
    [decisions],
  );

  const decisionsNeedingReview = useMemo(
    () => decisions.filter((decision) => decision.status === "review_suggested").length,
    [decisions],
  );

  const recallItems = useMemo(() => {
    if (!askResult || askResult.label !== "Evidence recall") return [];
    const payload = askResult.data as RecallResponse;
    return payload.results || payload.result?.results || [];
  }, [askResult]);

  const reflectText = useMemo(() => {
    if (!askResult || askResult.label !== "Memory synthesis") return null;
    const payload = askResult.data as ReflectResponse;
    return payload.result?.text || payload.text || payload.error || null;
  }, [askResult]);

  useEffect(() => {
    void Promise.all([loadWorkspaceData(), refreshMemoryStatus()]);
  }, []);

  async function post<T>(path: string, body?: object): Promise<T> {
    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || `Request failed with ${response.status}`);
    return data as T;
  }

  async function loadWorkspaceData() {
    setDbLoading(true);
    setDbError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", "novapay")
        .single();
      if (orgError || !org) throw orgError || new Error("NovaPay organization not found");

      const [eventsResult, decisionsResult] = await Promise.all([
        supabase
          .from("events")
          .select("id, external_id, event_type, title, content, event_date")
          .eq("organization_id", org.id)
          .order("event_date", { ascending: true }),
        supabase
          .from("decisions")
          .select("id, decision_key, title, summary, decision, rationale, status, confidence, decision_date")
          .eq("organization_id", org.id)
          .order("decision_date", { ascending: true }),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (decisionsResult.error) throw decisionsResult.error;

      const nextDecisions = (decisionsResult.data || []) as DecisionRow[];
      setEvents((eventsResult.data || []) as EventRow[]);
      setDecisions(nextDecisions);

      const dec021Row = nextDecisions.find((decision) => decision.decision_key === "DEC-021");
      if (dec021Row) {
        const { count, error } = await supabase
          .from("decision_reviews")
          .select("id", { count: "exact", head: true })
          .eq("decision_id", dec021Row.id);
        if (error) throw error;
        setReviewCount(count ?? 0);
      }
    } catch (error) {
      setDbError(error instanceof Error ? error.message : "Failed to load DecisionDNA workspace");
    } finally {
      setDbLoading(false);
    }
  }

  async function refreshMemoryStatus() {
    try {
      const data = await post<BankStatus>("/api/hindsight/status");
      if (typeof data.total === "number") setMemoryTotal(data.total);
      if (data.bankId) setBankId(data.bankId);
    } catch {
      setMemoryTotal(null);
    }
  }

  async function ask(mode: "recall" | "reflect") {
    const label = mode === "recall" ? "Evidence recall" : "Memory synthesis";
    setBusy(label);
    setAskResult(null);
    try {
      const data = await post<RecallResponse | ReflectResponse>(`/api/hindsight/${mode}`, { query });
      setAskResult({ label, data });
    } catch (error) {
      setAskResult({ label, data: { ok: false, error: error instanceof Error ? error.message : String(error) } });
    } finally {
      setBusy(null);
    }
  }

  async function persistDriftReview(data: DriftResponse) {
    if (!dec021 || !data.ok || !data.result?.text) return;

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("decision_reviews").insert({
      decision_id: dec021.id,
      status: "review_suggested",
      reason: "Original Redis operational constraint materially changed after adoption of managed Redis Cloud.",
      analysis: data.result.text,
      confidence: 0.95,
      evidence_count: data.evidenceCount ?? 0,
      hindsight_response: data,
    });

    if (!error) setReviewCount((count) => count + 1);
    else console.error("Failed to persist Decision Drift review", error);
  }

  async function runDriftReview() {
    setBusy("Decision Drift");
    setDrift(null);
    try {
      const data = await post<DriftResponse>("/api/hindsight/drift");
      setDrift(data);
      if (typeof data.memoryTotal === "number") setMemoryTotal(data.memoryTotal);
      await persistDriftReview(data);
    } catch (error) {
      setDrift({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">D</div>
          <div>
            <strong>DecisionDNA</strong>
            <span>Organizational memory</span>
          </div>
        </div>

        <nav className="navList">
          <a className="navItem active" href="#overview"><span>◫</span>Overview</a>
          <a className="navItem" href="#decisions"><span>◇</span>Decisions</a>
          <a className="navItem" href="#ask"><span>◎</span>Ask memory</a>
          <a className="navItem" href="#timeline"><span>↝</span>Timeline</a>
          <a className="navItem" href="#memory"><span>◉</span>Memory health</a>
        </nav>

        <div className="sidebarFooter">
          <div className="workspaceBadge">
            <span className="workspaceAvatar">N</span>
            <div><strong>NovaPay</strong><span>Engineering workspace</span></div>
          </div>
          <div className="poweredBy">Hindsight + Supabase</div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="topEyebrow">NOVAPAY / ENGINEERING</p>
            <h1>Decision intelligence</h1>
          </div>
          <div className="topActions">
            <div className="memoryLive"><span className="liveDot" />Live product data</div>
            <button className="primaryBtn compact" onClick={() => document.getElementById("ask")?.scrollIntoView({ behavior: "smooth" })}>Ask memory</button>
          </div>
        </header>

        <div className="contentWrap">
          <section id="overview" className="overviewHero">
            <div className="heroCopy">
              <p className="sectionKicker">ORGANIZATIONAL MEMORY</p>
              <h2>Your team remembers what happened.<br /><span>DecisionDNA remembers why.</span></h2>
              <p>
                Supabase stores the product state and decision workflow. Hindsight stores the organization&apos;s semantic and temporal memory and reasons across it.
              </p>
            </div>
            <div className="memoryPulse">
              <div className="pulseRing"><div className="pulseCore">{memoryTotal ?? "—"}</div></div>
              <strong>Active memories</strong>
              <span>{bankId}</span>
            </div>
          </section>

          {dbError ? <article className="driftResult"><div className="analysisText compactText">Database error: {dbError}</div></article> : null}

          <section className="statsGrid" aria-label="Decision health metrics">
            <article className="statCard">
              <span className="statLabel">Organizational events</span>
              <strong>{dbLoading ? "—" : events.length}</strong>
              <span className="statDelta positive">Supabase timeline records</span>
            </article>
            <article className="statCard">
              <span className="statLabel">Extracted memories</span>
              <strong>{memoryTotal ?? "—"}</strong>
              <span className="statDelta positive">Hindsight knowledge units</span>
            </article>
            <article className="statCard">
              <span className="statLabel">Tracked decisions</span>
              <strong>{dbLoading ? "—" : decisions.length}</strong>
              <span className="statDelta">{decisions.map((item) => item.decision_key).join(" · ") || "Loading…"}</span>
            </article>
            <article className="statCard attention">
              <span className="statLabel">Needs review</span>
              <strong>{dbLoading ? "—" : decisionsNeedingReview}</strong>
              <span className="statDelta warningText">{reviewCount} persisted review{reviewCount === 1 ? "" : "s"}</span>
            </article>
          </section>

          <section id="decisions" className="sectionBlock">
            <div className="sectionHeader">
              <div><p className="sectionKicker">DECISION HEALTH</p><h3>Decisions requiring attention</h3></div>
              <span className="smallMeta">Supabase state + Hindsight evidence</span>
            </div>

            <article className="decisionCard">
              <div className="decisionMain">
                <div className="decisionTopline">
                  <span className="reviewBadge"><span /> {(dec021?.status || "review_suggested").replaceAll("_", " ").toUpperCase()}</span>
                  <span className="decisionId">{dec021?.decision_key || "DEC-021"} · {prettyDate(dec021?.decision_date)}</span>
                </div>
                <h4>{dec021?.title || "Redis session architecture"}</h4>
                <p className="decisionSummary">{dec021?.summary || "Loading decision record from Supabase…"}</p>
                <div className="reasonGrid">
                  <div><span>Decision</span><strong>{dec021?.decision || "Loading…"}</strong></div>
                  <div><span>Original rationale</span><strong>{dec021?.rationale || "Loading…"}</strong></div>
                  <div><span>Current signal</span><strong>Managed Redis externalized the operational burden identified in INC-142.</strong></div>
                </div>
              </div>
              <div className="decisionAside">
                <div className="confidenceRing"><strong>{dec021?.confidence ? `${Math.round(dec021.confidence * 100)}%` : "High"}</strong><span>confidence</span></div>
                <button className="primaryBtn" disabled={!!busy || !dec021} onClick={runDriftReview}>
                  {busy === "Decision Drift" ? "Reviewing history…" : "Run live review"}
                </button>
              </div>
            </article>

            {drift ? (
              <article className="driftResult">
                <div className="driftResultHeader">
                  <div><span className="resultEyebrow">LIVE HINDSIGHT ANALYSIS</span><h4>{drift.ok ? "Decision Drift detected" : "Review failed"}</h4></div>
                  {drift.ok ? <span className="evidenceCount">{drift.evidenceCount ?? 0} evidence units</span> : null}
                </div>
                <div className="analysisText">{formatAnswer(drift.result?.text || drift.error)}</div>
                {drift.evidence?.length ? (
                  <details className="evidenceDrawer">
                    <summary>View supporting organizational memories</summary>
                    <div className="evidenceList">
                      {drift.evidence.slice(0, 8).map((item, index) => (
                        <div className="evidenceItem" key={`${item.rank}-${index}`}>
                          <span className="evidenceRank">{String(item.rank ?? index + 1).padStart(2, "0")}</span>
                          <div><span className="memoryType">{item.type || "memory"}</span><p>{item.text}</p></div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            ) : null}
          </section>

          <section id="ask" className="askPanel">
            <div className="askIntro">
              <p className="sectionKicker">ASK ORGANIZATIONAL MEMORY</p>
              <h3>Ask “why?” without hunting through old docs.</h3>
              <p>Recall retrieves evidence. Reflect reasons across accumulated organizational memory.</p>
              <div className="suggestionList">
                {suggestedQuestions.map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}
              </div>
            </div>
            <div className="askConsole">
              <label htmlFor="memory-question">Question</label>
              <textarea id="memory-question" value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
              <div className="askActions">
                <button className="secondaryBtn" disabled={!!busy} onClick={() => ask("recall")}>{busy === "Evidence recall" ? "Searching…" : "Recall evidence"}</button>
                <button className="primaryBtn" disabled={!!busy} onClick={() => ask("reflect")}>{busy === "Memory synthesis" ? "Reasoning…" : "Synthesize answer"}</button>
              </div>

              {recallItems.length > 0 ? (
                <div className="answerPanel">
                  <div className="answerHeader"><span>Retrieved evidence</span><span>{recallItems.length} memories</span></div>
                  {recallItems.slice(0, 6).map((item, index) => (
                    <div className="recallRow" key={index}><span>{String(index + 1).padStart(2, "0")}</span><p>{item.text}</p></div>
                  ))}
                </div>
              ) : null}

              {reflectText ? (
                <div className="answerPanel synthesis">
                  <div className="answerHeader"><span>DecisionDNA synthesis</span><span>Reflect</span></div>
                  <div className="analysisText compactText">{formatAnswer(reflectText)}</div>
                </div>
              ) : null}
            </div>
          </section>

          <section id="timeline" className="sectionBlock">
            <div className="sectionHeader">
              <div><p className="sectionKicker">ORGANIZATIONAL TIMELINE</p><h3>How DEC-021 evolved over time</h3></div>
              <span className="smallMeta">Loaded from Supabase events</span>
            </div>
            <div className="evidenceList">
              {events.map((event, index) => (
                <div className="evidenceItem" key={event.id}>
                  <span className="evidenceRank">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <span className="memoryType">{event.event_type.replaceAll("_", " ")} · {prettyDate(event.event_date)}</span>
                    <p><strong>{eventLabel(event)}</strong><br />{event.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="memory" className="sectionBlock">
            <div className="sectionHeader">
              <div><p className="sectionKicker">MEMORY HEALTH</p><h3>Two systems, one product.</h3></div>
            </div>
            <section className="statsGrid">
              <article className="statCard"><span className="statLabel">Hindsight</span><strong>{memoryTotal ?? "—"}</strong><span className="statDelta positive">Semantic + temporal memories</span></article>
              <article className="statCard"><span className="statLabel">Supabase events</span><strong>{events.length}</strong><span className="statDelta">Product timeline state</span></article>
              <article className="statCard"><span className="statLabel">Supabase decisions</span><strong>{decisions.length}</strong><span className="statDelta">Workflow records</span></article>
              <article className="statCard"><span className="statLabel">Review history</span><strong>{reviewCount}</strong><span className="statDelta warningText">Persisted Decision Drift analyses</span></article>
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}
