"use client";

import { useEffect, useMemo, useState } from "react";

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
  error?: string;
};

type ApiState = {
  label: string;
  data: unknown;
} | null;

const timeline = [
  {
    date: "Jan 12",
    year: "2026",
    title: "Redis proposed",
    body: "Platform proposes Redis for checkout sessions to reduce latency during flash-sale traffic.",
    tone: "neutral",
  },
  {
    date: "Jan 18",
    year: "2026",
    title: "DEC-017 · Trial approved",
    body: "Limited rollout approved with strict memory and staffing constraints.",
    tone: "info",
  },
  {
    date: "Feb 03",
    year: "2026",
    title: "INC-142 · Production incident",
    body: "Traffic reaches 4.2× normal volume. Redis memory exceeds 92%, sessions are lost, conversion drops.",
    tone: "danger",
  },
  {
    date: "Feb 05",
    year: "2026",
    title: "DEC-021 · Redis rejected",
    body: "NovaPay returns checkout sessions to PostgreSQL due to operational burden and memory-management risk.",
    tone: "warning",
  },
  {
    date: "Mar 15",
    year: "2026",
    title: "PostgreSQL outcome validated",
    body: "Two campaigns complete within SLO with no session-loss incidents.",
    tone: "success",
  },
  {
    date: "Aug 14",
    year: "2026",
    title: "Managed Redis introduced",
    body: "Provider takes ownership of patching, failover, scaling, backups, and capacity operations.",
    tone: "info",
  },
  {
    date: "Sep 10",
    year: "2026",
    title: "Constraint materially changed",
    body: "Managed Redis survives traffic spikes with no incidents and substantially less operational effort.",
    tone: "success",
  },
  {
    date: "Now",
    year: "",
    title: "Decision Drift detected",
    body: "The main reason behind DEC-021 no longer holds. DecisionDNA recommends a formal review, not an automatic migration.",
    tone: "review",
  },
];

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

export default function Home() {
  const [query, setQuery] = useState(suggestedQuestions[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [memoryTotal, setMemoryTotal] = useState<number | null>(null);
  const [bankId, setBankId] = useState("decisiondna-novapay");
  const [askResult, setAskResult] = useState<ApiState>(null);
  const [drift, setDrift] = useState<DriftResponse | null>(null);
  const [developerResult, setDeveloperResult] = useState<ApiState>(null);

  const memoryLabel = memoryTotal === null ? "Checking…" : `${memoryTotal} memories`;

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function post<T>(path: string, body?: object): Promise<T> {
    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || `Request failed with status ${response.status}`);
    }
    return data as T;
  }

  async function refreshStatus() {
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
      const data = await post<RecallResponse | ReflectResponse>(
        `/api/hindsight/${mode}`,
        { query },
      );
      setAskResult({ label, data });
    } catch (error) {
      setAskResult({ label, data: { ok: false, error: String(error) } });
    } finally {
      setBusy(null);
    }
  }

  async function runDriftReview() {
    setBusy("Decision Drift");
    setDrift(null);
    try {
      const data = await post<DriftResponse>("/api/hindsight/drift");
      setDrift(data);
      if (typeof data.memoryTotal === "number") setMemoryTotal(data.memoryTotal);
    } catch (error) {
      setDrift({ ok: false, error: String(error) });
    } finally {
      setBusy(null);
    }
  }

  async function runDeveloperAction(label: string, path: string) {
    setBusy(label);
    setDeveloperResult(null);
    try {
      const data = await post<Record<string, unknown>>(path);
      setDeveloperResult({ label, data });
      await refreshStatus();
    } catch (error) {
      setDeveloperResult({ label, data: { ok: false, error: String(error) } });
    } finally {
      setBusy(null);
    }
  }

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
            <div>
              <strong>NovaPay</strong>
              <span>Engineering workspace</span>
            </div>
          </div>
          <div className="poweredBy">Powered by Hindsight</div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="topEyebrow">NOVAPAY / ENGINEERING</p>
            <h1>Decision intelligence</h1>
          </div>
          <div className="topActions">
            <div className="memoryLive"><span className="liveDot" />Hindsight live</div>
            <button className="primaryBtn compact" onClick={() => document.getElementById("ask")?.scrollIntoView({ behavior: "smooth" })}>Ask memory</button>
          </div>
        </header>

        <div className="contentWrap">
          <section id="overview" className="overviewHero">
            <div className="heroCopy">
              <p className="sectionKicker">ORGANIZATIONAL MEMORY</p>
              <h2>Your team remembers what happened.<br /><span>DecisionDNA remembers why.</span></h2>
              <p>
                Turn scattered decisions, incidents, constraints, and outcomes into living organizational intelligence that gets more useful as history accumulates.
              </p>
            </div>
            <div className="memoryPulse">
              <div className="pulseRing"><div className="pulseCore">{memoryTotal ?? "—"}</div></div>
              <strong>Active memories</strong>
              <span>{bankId}</span>
            </div>
          </section>

          <section className="statsGrid" aria-label="Decision health metrics">
            <article className="statCard">
              <span className="statLabel">Organizational events</span>
              <strong>8</strong>
              <span className="statDelta positive">Seeded into memory</span>
            </article>
            <article className="statCard">
              <span className="statLabel">Extracted memories</span>
              <strong>{memoryTotal ?? "—"}</strong>
              <span className="statDelta positive">Hindsight knowledge units</span>
            </article>
            <article className="statCard">
              <span className="statLabel">Tracked decisions</span>
              <strong>2</strong>
              <span className="statDelta">DEC-017 · DEC-021</span>
            </article>
            <article className="statCard attention">
              <span className="statLabel">Needs review</span>
              <strong>1</strong>
              <span className="statDelta warningText">Constraint changed</span>
            </article>
          </section>

          <section id="decisions" className="sectionBlock">
            <div className="sectionHeader">
              <div>
                <p className="sectionKicker">DECISION HEALTH</p>
                <h3>Decisions requiring attention</h3>
              </div>
              <span className="smallMeta">Last analyzed from {memoryLabel}</span>
            </div>

            <article className="decisionCard">
              <div className="decisionMain">
                <div className="decisionTopline">
                  <span className="reviewBadge"><span /> REVIEW SUGGESTED</span>
                  <span className="decisionId">DEC-021 · Feb 05, 2026</span>
                </div>
                <h4>Redis session architecture</h4>
                <p className="decisionSummary">
                  NovaPay rejected self-managed Redis for checkout sessions after INC-142 because the Platform team could not justify the operational burden and memory-management risk.
                </p>
                <div className="reasonGrid">
                  <div>
                    <span>Original constraint</span>
                    <strong>Redis operations had to be owned internally</strong>
                  </div>
                  <div>
                    <span>What changed</span>
                    <strong>Managed Redis externalized operations</strong>
                  </div>
                  <div>
                    <span>Current signal</span>
                    <strong>Traffic spikes handled without manual intervention</strong>
                  </div>
                </div>
              </div>
              <div className="decisionAside">
                <div className="confidenceRing"><strong>High</strong><span>confidence</span></div>
                <button className="primaryBtn" disabled={!!busy} onClick={runDriftReview}>
                  {busy === "Decision Drift" ? "Reviewing history…" : "Run live review"}
                </button>
              </div>
            </article>

            {drift && (
              <article className="driftResult">
                <div className="driftResultHeader">
                  <div>
                    <span className="resultEyebrow">LIVE HINDSIGHT ANALYSIS</span>
                    <h4>{drift.ok ? "Decision Drift detected" : "Review failed"}</h4>
                  </div>
                  {drift.ok && <span className="evidenceCount">{drift.evidenceCount ?? 0} evidence units</span>}
                </div>
                <div className="analysisText">{formatAnswer(drift.result?.text || drift.error)}</div>
                {drift.evidence?.length ? (
                  <details className="evidenceDrawer">
                    <summary>View supporting organizational memories</summary>
                    <div className="evidenceList">
                      {drift.evidence.slice(0, 8).map((item, index) => (
                        <div className="evidenceItem" key={`${item.rank}-${index}`}>
                          <span className="evidenceRank">{String(item.rank ?? index + 1).padStart(2, "0")}</span>
                          <div>
                            <span className="memoryType">{item.type || "memory"}</span>
                            <p>{item.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            )}
          </section>

          <section id="ask" className="askPanel">
            <div className="askIntro">
              <p className="sectionKicker">ASK ORGANIZATIONAL MEMORY</p>
              <h3>Ask “why?” without hunting through old docs.</h3>
              <p>DecisionDNA searches Hindsight for historical evidence and can synthesize reasoning across decisions, incidents, constraints, and later outcomes.</p>
              <div className="suggestionList">
                {suggestedQuestions.map((item) => (
                  <button key={item} onClick={() => setQuery(item)}>{item}</button>
                ))}
              </div>
            </div>
            <div className="askConsole">
              <label htmlFor="memory-question">Question</label>
              <textarea id="memory-question" value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
              <div className="askActions">
                <button className="secondaryBtn" disabled={!!busy} onClick={() => ask("recall")}>
                  {busy === "Evidence recall" ? "Searching…" : "Recall evidence"}
                </button>
                <button className="primaryBtn" disabled={!!busy} onClick={() => ask("reflect")}>
                  {busy === "Memory synthesis" ? "Reasoning…" : "Synthesize answer"}
                </button>
              </div>

              {recallItems.length > 0 && (
                <div className="answerPanel">
                  <div className="answerHeader"><span>Retrieved evidence</span><span>{recallItems.length} memories</span></div>
                  {recallItems.slice(0, 6).map((item, index) => (
                    <div className="recallRow" key={index}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {reflectText && (
                <div className="answerPanel synthesis">
                  <div className="answerHeader"><span>DecisionDNA synthesis</span><span>Hindsight reflect</span></div>
                  <div className="analysisText compactText">{formatAnswer(reflectText)}</div>
                </div>
              )}
            </div>
          </section>

          <section id="timeline" className="sectionBlock">
            <div className="sectionHeader">
              <div>
                <p className="sectionKicker">DECISION TIMELINE</p>
                <h3>How one decision evolved over time</h3>
              </div>
              <span className="smallMeta">Proposal → incident → decision → new evidence</span>
            </div>
            <div className="timeline">
              {timeline.map((item, index) => (
                <article className="timelineItem" key={`${item.date}-${item.title}`}>
                  <div className="timelineDate"><strong>{item.date}</strong><span>{item.year}</span></div>
                  <div className="timelineRail"><span className={`timelineDot ${item.tone}`} />{index < timeline.length - 1 && <span className="timelineLine" />}</div>
                  <div className="timelineContent"><h4>{item.title}</h4><p>{item.body}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section id="memory" className="memoryHealth">
            <div>
              <p className="sectionKicker">MEMORY HEALTH</p>
              <h3>Hindsight connection</h3>
              <p>The production UI uses the same retain, recall, and reflect pipeline verified in Milestone 1.</p>
            </div>
            <div className="healthGrid">
              <div><span>Bank</span><strong>{bankId}</strong></div>
              <div><span>Status</span><strong className="healthy">● Connected</strong></div>
              <div><span>Memories</span><strong>{memoryTotal ?? "—"}</strong></div>
            </div>
            <details className="developerPanel">
              <summary>Developer memory controls</summary>
              <p>These controls are kept for development and demo reset flows. They are intentionally separate from the product experience.</p>
              <div className="developerActions">
                <button className="secondaryBtn" disabled={!!busy} onClick={() => runDeveloperAction("Bank setup", "/api/hindsight/setup")}>Create / update bank</button>
                <button className="secondaryBtn" disabled={!!busy} onClick={() => runDeveloperAction("Seed history", "/api/hindsight/seed")}>Seed NovaPay history</button>
                <button className="secondaryBtn" disabled={!!busy} onClick={() => runDeveloperAction("Bank status", "/api/hindsight/status")}>Refresh bank status</button>
              </div>
              {developerResult && <pre className="developerOutput">{JSON.stringify(developerResult.data, null, 2)}</pre>}
            </details>
          </section>

          <footer className="productFooter">
            <span>DecisionDNA · Living organizational decision intelligence</span>
            <span>NovaPay demo workspace</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
