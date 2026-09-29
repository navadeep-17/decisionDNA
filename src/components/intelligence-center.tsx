"use client";

import { useMemo, useState } from "react";
import styles from "./intelligence-center-v2.module.css";

type Tool = {
  id: string;
  mountId: string;
  icon: string;
  title: string;
  subtitle: string;
  category: "Before decision" | "Decision health" | "Memory quality" | "Org learning";
  featured?: boolean;
};

type JudgeStep = {
  eyebrow: string;
  title: string;
  explanation: string;
  action: string;
  toolId?: string;
  scrollTo?: string;
  demoLine: string;
};

const tools: Tool[] = [
  {
    id: "gaps",
    mountId: "tool-knowledge-gaps",
    icon: "?",
    title: "Knowledge Gap Radar",
    subtitle: "What evidence is still missing before this proposal is ready for human review?",
    category: "Before decision",
    featured: true,
  },
  {
    id: "proposal",
    mountId: "tool-proposal-guard",
    icon: "↺",
    title: "Proposal Guard",
    subtitle: "Detect whether the organization has tried this before and recover the old rationale.",
    category: "Before decision",
  },
  {
    id: "contract",
    mountId: "tool-decision-contract",
    icon: "§",
    title: "Decision Contract",
    subtitle: "Evaluate original assumptions, success criteria, and explicit change-our-mind conditions.",
    category: "Decision health",
    featured: true,
  },
  {
    id: "trust",
    mountId: "tool-trust-score",
    icon: "%",
    title: "Memory Trust Score",
    subtitle: "Explain how evidence support, outcomes, consistency, and freshness affect trust today.",
    category: "Decision health",
  },
  {
    id: "drift",
    mountId: "tool-drift-scanner",
    icon: "∆",
    title: "Decision Drift",
    subtitle: "Scan tracked decisions for assumptions that no longer hold and surface review targets.",
    category: "Decision health",
    featured: true,
  },
  {
    id: "replay",
    mountId: "tool-decision-replay",
    icon: "◷",
    title: "Memory Time Travel",
    subtitle: "Reconstruct what the team knew then versus what the organization knows now.",
    category: "Memory quality",
    featured: true,
  },
  {
    id: "shockwave",
    mountId: "tool-shockwave",
    icon: "◎",
    title: "Decision Shockwave",
    subtitle: "Trace how one new memory propagates through decisions, assumptions, and lessons.",
    category: "Memory quality",
    featured: true,
  },
  {
    id: "contradictions",
    mountId: "tool-contradictions",
    icon: "≠",
    title: "Contradiction Radar",
    subtitle: "Separate true memory conflicts from legitimate decision evolution and stale assumptions.",
    category: "Memory quality",
  },
  {
    id: "patterns",
    mountId: "tool-patterns",
    icon: "✦",
    title: "Pattern Intelligence",
    subtitle: "Reflect across organizational memory to surface recurring patterns and durable lessons.",
    category: "Org learning",
  },
];

const judgeSteps: JudgeStep[] = [
  {
    eyebrow: "01 · BEFORE THE DECISION",
    title: "Ask what the organization still does not know.",
    explanation: "Start with the managed-Redis proposal. DecisionDNA separates remembered evidence from material gaps instead of inventing missing facts.",
    action: "Run Knowledge Gap Radar",
    toolId: "gaps",
    demoLine: "Before making a decision, DecisionDNA tells us what evidence is still missing.",
  },
  {
    eyebrow: "02 · TERMS OF VALIDITY",
    title: "Show that DEC-021 defined what would change our mind.",
    explanation: "The decision contract was persisted before reconsideration. Reversal conditions are evaluated against memory later, not invented after the fact.",
    action: "Open Decision Contract",
    toolId: "contract",
    demoLine: "DEC-021 explicitly said we should reconsider if Redis operations became externally managed.",
  },
  {
    eyebrow: "03 · NEW EVIDENCE ARRIVES",
    title: "Teach DecisionDNA the managed-Redis shadow-test result.",
    explanation: "Add the prefilled evidence to the organizational timeline. It is stored in Supabase, retained by Hindsight, and immediately connected to historical context.",
    action: "Go to Add Memory",
    scrollTo: "ingest",
    demoLine: "Now new evidence arrives months later. We teach it to the organization's persistent memory.",
  },
  {
    eyebrow: "04 · IMPACT PROPAGATION",
    title: "Visualize the blast radius of one new memory.",
    explanation: "Decision Shockwave maps the new evidence to affected decisions, changed assumptions, updated lessons, and human review targets.",
    action: "Run Decision Shockwave",
    toolId: "shockwave",
    demoLine: "One new memory changes more than one card — DecisionDNA traces the full downstream impact.",
  },
  {
    eyebrow: "05 · MEMORY TIME TRAVEL",
    title: "Compare what NovaPay knew then with what it knows now.",
    explanation: "Decision Replay separates pre-decision evidence from later knowledge and exposes the assumptions whose context changed.",
    action: "Replay DEC-021",
    toolId: "replay",
    demoLine: "The decision was reasonable then. The context changed later. DecisionDNA can show both without rewriting history.",
  },
  {
    eyebrow: "06 · HUMAN REVIEW",
    title: "Close by showing the decision has drifted — not by auto-reversing it.",
    explanation: "The drift scanner re-checks historical decisions against accumulated Hindsight memory and only recommends human review where the evidence warrants it.",
    action: "Scan Decision Drift",
    toolId: "drift",
    demoLine: "DecisionDNA does not replace the decision-maker. It knows when the reasons behind an old decision deserve another look.",
  },
];

function launchMountedTool(mountId: string) {
  const button = document.querySelector<HTMLButtonElement>(`#${mountId} > button`);
  button?.click();
}

export default function IntelligenceCenter() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"center" | "judge">("center");
  const [judgeStep, setJudgeStep] = useState(0);

  const activeStep = judgeSteps[judgeStep];
  const categories = useMemo(
    () => ["Before decision", "Decision health", "Memory quality", "Org learning"] as const,
    [],
  );

  function launchTool(toolId: string) {
    const tool = tools.find((item) => item.id === toolId);
    if (!tool) return;
    setOpen(false);
    window.setTimeout(() => launchMountedTool(tool.mountId), 90);
  }

  function runJudgeAction() {
    if (activeStep.scrollTo) {
      setJudgeStep((step) => Math.min(step + 1, judgeSteps.length - 1));
      setOpen(false);
      window.setTimeout(() => {
        document.getElementById(activeStep.scrollTo!)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }

    if (activeStep.toolId) {
      setJudgeStep((step) => Math.min(step + 1, judgeSteps.length - 1));
      launchTool(activeStep.toolId);
    }
  }

  return (
    <>
      <button className={styles.launcher} type="button" onClick={() => setOpen(true)}>
        <span className={styles.launcherIcon}>✦</span>
        <span>
          <strong>Intelligence Center</strong>
          <small>Judge mode + 9 memory tools</small>
        </span>
        <span className={styles.launcherArrow}>⌘</span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.header}>
              <div>
                <p>DECISIONDNA / ORGANIZATIONAL MEMORY</p>
                <h2>Intelligence Center</h2>
                <span>One place for every memory-native capability.</span>
              </div>
              <div className={styles.headerActions}>
                <button className={mode === "judge" ? styles.modeActive : ""} type="button" onClick={() => setMode("judge")}>
                  ▶ Judge mode
                </button>
                <button className={mode === "center" ? styles.modeActive : ""} type="button" onClick={() => setMode("center")}>
                  Intelligence tools
                </button>
                <button className={styles.closeButton} type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
              </div>
            </header>

            {mode === "judge" ? (
              <div className={styles.judgeLayout}>
                <aside className={styles.stepRail}>
                  <div className={styles.stepRailHeader}>
                    <span>60-SECOND STORY</span>
                    <strong>Why memory changes decisions</strong>
                  </div>
                  {judgeSteps.map((step, index) => (
                    <button
                      type="button"
                      key={step.eyebrow}
                      className={`${styles.stepButton} ${index === judgeStep ? styles.stepActive : ""} ${index < judgeStep ? styles.stepDone : ""}`}
                      onClick={() => setJudgeStep(index)}
                    >
                      <span>{index < judgeStep ? "✓" : String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <small>{step.eyebrow}</small>
                      </div>
                    </button>
                  ))}
                </aside>

                <main className={styles.judgeStage}>
                  <div className={styles.judgeProgress}>
                    <span style={{ width: `${((judgeStep + 1) / judgeSteps.length) * 100}%` }} />
                  </div>
                  <p className={styles.eyebrow}>{activeStep.eyebrow}</p>
                  <h3>{activeStep.title}</h3>
                  <p className={styles.judgeExplanation}>{activeStep.explanation}</p>

                  <article className={styles.demoScript}>
                    <span>WHAT TO SAY</span>
                    <p>“{activeStep.demoLine}”</p>
                  </article>

                  <div className={styles.judgeControls}>
                    <button type="button" className={styles.secondaryButton} disabled={judgeStep === 0} onClick={() => setJudgeStep((step) => Math.max(0, step - 1))}>
                      ← Previous
                    </button>
                    <button type="button" className={styles.primaryButton} onClick={runJudgeAction}>
                      {activeStep.action} →
                    </button>
                    {judgeStep < judgeSteps.length - 1 ? (
                      <button type="button" className={styles.textButton} onClick={() => setJudgeStep((step) => Math.min(judgeSteps.length - 1, step + 1))}>
                        Skip step
                      </button>
                    ) : null}
                  </div>

                  <div className={styles.judgeFooter}>
                    <span>STEP {judgeStep + 1} / {judgeSteps.length}</span>
                    <p>Human-controlled throughout · Hindsight supplies persistent semantic + temporal memory.</p>
                  </div>
                </main>
              </div>
            ) : (
              <div className={styles.centerBody}>
                <section className={styles.centerHero}>
                  <div>
                    <p className={styles.eyebrow}>MEMORY-NATIVE INTELLIGENCE</p>
                    <h3>From “what happened?” to “what changed our decision?”</h3>
                    <p>DecisionDNA organizes its capabilities around the decision lifecycle instead of exposing a collection of unrelated AI widgets.</p>
                  </div>
                  <button type="button" className={styles.primaryButton} onClick={() => setMode("judge")}>
                    Start judge mode →
                  </button>
                </section>

                {categories.map((category) => (
                  <section className={styles.category} key={category}>
                    <div className={styles.categoryHeader}>
                      <span>{category.toUpperCase()}</span>
                      <small>{tools.filter((tool) => tool.category === category).length} capabilities</small>
                    </div>
                    <div className={styles.toolGrid}>
                      {tools.filter((tool) => tool.category === category).map((tool) => (
                        <button type="button" className={styles.toolCard} key={tool.id} onClick={() => launchTool(tool.id)}>
                          <div className={styles.toolTopline}>
                            <span className={styles.toolIcon}>{tool.icon}</span>
                            {tool.featured ? <span className={styles.featured}>JUDGE PICK</span> : null}
                          </div>
                          <strong>{tool.title}</strong>
                          <p>{tool.subtitle}</p>
                          <span className={styles.openLabel}>Open capability →</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
