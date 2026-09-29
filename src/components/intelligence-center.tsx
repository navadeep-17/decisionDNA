"use client";

import { useEffect, useState } from "react";
import styles from "./intelligence-center-v2.module.css";

type Tool = {
  id: string;
  mountId: string;
  icon: string;
  title: string;
  subtitle: string;
  category: "Before decision" | "Decision health" | "Memory quality" | "Org learning";
  recommended?: boolean;
};

const tools: Tool[] = [
  {
    id: "gaps",
    mountId: "tool-knowledge-gaps",
    icon: "?",
    title: "Knowledge Gap Radar",
    subtitle: "Find the evidence still missing before a proposal is ready for human review.",
    category: "Before decision",
    recommended: true,
  },
  {
    id: "proposal",
    mountId: "tool-proposal-guard",
    icon: "↺",
    title: "Proposal Guard",
    subtitle: "Recover similar historical attempts, old rationale, outcomes, and changed context.",
    category: "Before decision",
  },
  {
    id: "contract",
    mountId: "tool-decision-contract",
    icon: "§",
    title: "Decision Contract",
    subtitle: "Track assumptions, success criteria, and the conditions that should trigger reconsideration.",
    category: "Decision health",
    recommended: true,
  },
  {
    id: "trust",
    mountId: "tool-trust-score",
    icon: "%",
    title: "Memory Trust Score",
    subtitle: "Explain how support, outcomes, consistency, and freshness affect confidence today.",
    category: "Decision health",
  },
  {
    id: "drift",
    mountId: "tool-drift-scanner",
    icon: "∆",
    title: "Decision Drift",
    subtitle: "Detect decisions whose original assumptions or constraints no longer hold.",
    category: "Decision health",
    recommended: true,
  },
  {
    id: "replay",
    mountId: "tool-decision-replay",
    icon: "◷",
    title: "Memory Time Travel",
    subtitle: "Compare what the team knew when a decision was made with what it knows now.",
    category: "Memory quality",
    recommended: true,
  },
  {
    id: "shockwave",
    mountId: "tool-shockwave",
    icon: "◎",
    title: "Decision Shockwave",
    subtitle: "Trace how one new memory affects decisions, assumptions, and organizational lessons.",
    category: "Memory quality",
    recommended: true,
  },
  {
    id: "contradictions",
    mountId: "tool-contradictions",
    icon: "≠",
    title: "Contradiction Radar",
    subtitle: "Separate genuine memory conflicts from normal decision evolution and stale assumptions.",
    category: "Memory quality",
  },
  {
    id: "patterns",
    mountId: "tool-patterns",
    icon: "✦",
    title: "Pattern Intelligence",
    subtitle: "Surface recurring organizational patterns and durable lessons across remembered history.",
    category: "Org learning",
  },
];

const categories = [
  {
    name: "Before decision" as const,
    label: "Before a decision",
    description: "Check what history already knows and what evidence is still missing.",
  },
  {
    name: "Decision health" as const,
    label: "Decision health",
    description: "Understand whether an existing decision is still supported by its original reasoning.",
  },
  {
    name: "Memory quality" as const,
    label: "Memory quality",
    description: "Inspect temporal context, conflicts, and the downstream impact of new evidence.",
  },
  {
    name: "Org learning" as const,
    label: "Organization learning",
    description: "Turn individual memories into reusable organizational insight.",
  },
];

function launchMountedTool(mountId: string) {
  const button = document.querySelector<HTMLButtonElement>(`#${mountId} > button`);
  button?.click();
}

export default function IntelligenceCenter() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("decisiondna:open-intelligence", handleOpen);
    return () => window.removeEventListener("decisiondna:open-intelligence", handleOpen);
  }, []);

  function launchTool(toolId: string) {
    const tool = tools.find((item) => item.id === toolId);
    if (!tool) return;

    setOpen(false);
    window.setTimeout(() => launchMountedTool(tool.mountId), 90);
  }

  return (
    <>
      <button className={styles.launcher} type="button" onClick={() => setOpen(true)}>
        <span className={styles.launcherIcon}>✦</span>
        <span className={styles.launcherCopy}>
          <strong>Intelligence Center</strong>
          <small>9 organizational memory capabilities</small>
        </span>
        <span className={styles.launcherArrow}>Open</span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section
            className={styles.panel}
            onMouseDown={(event) => event.stopPropagation()}
            aria-label="DecisionDNA Intelligence Center"
          >
            <header className={styles.header}>
              <div>
                <p className={styles.productEyebrow}>DECISIONDNA · ORGANIZATIONAL MEMORY</p>
                <h2>Intelligence Center</h2>
                <span>Choose a capability based on where you are in the decision lifecycle.</span>
              </div>
              <button
                className={styles.closeButton}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Intelligence Center"
              >
                ×
              </button>
            </header>

            <div className={styles.centerBody}>
              <section className={styles.centerHero}>
                <div>
                  <p className={styles.eyebrow}>MEMORY-NATIVE DECISION INTELLIGENCE</p>
                  <h3>Understand why a decision made sense—and when its context changes.</h3>
                  <p>
                    Explore remembered rationale, constraints, incidents, outcomes, contradictions, and changed assumptions without losing the historical context around them.
                  </p>
                </div>

                <div className={styles.heroSignals}>
                  <div>
                    <strong>9</strong>
                    <span>capabilities</span>
                  </div>
                  <div>
                    <strong>Evidence-first</strong>
                    <span>reasoning</span>
                  </div>
                  <div>
                    <strong>Human</strong>
                    <span>final review</span>
                  </div>
                </div>
              </section>

              <section className={styles.lifecycleStrip} aria-label="Decision lifecycle">
                <div><span>01</span><strong>Explore</strong><small>What do we know?</small></div>
                <div><span>02</span><strong>Decide</strong><small>Why is this valid?</small></div>
                <div><span>03</span><strong>Re-evaluate</strong><small>What changed?</small></div>
                <div><span>04</span><strong>Learn</strong><small>What should persist?</small></div>
              </section>

              {categories.map((category) => {
                const categoryTools = tools.filter((tool) => tool.category === category.name);
                return (
                  <section className={styles.category} key={category.name}>
                    <div className={styles.categoryHeader}>
                      <div>
                        <span>{category.label.toUpperCase()}</span>
                        <p>{category.description}</p>
                      </div>
                      <small>{categoryTools.length} {categoryTools.length === 1 ? "capability" : "capabilities"}</small>
                    </div>

                    <div className={styles.toolGrid}>
                      {categoryTools.map((tool) => (
                        <button
                          type="button"
                          className={styles.toolCard}
                          key={tool.id}
                          onClick={() => launchTool(tool.id)}
                        >
                          <div className={styles.toolTopline}>
                            <span className={styles.toolIcon}>{tool.icon}</span>
                            {tool.recommended ? <span className={styles.coreBadge}>CORE</span> : null}
                          </div>
                          <strong>{tool.title}</strong>
                          <p>{tool.subtitle}</p>
                          <span className={styles.openLabel}>Open capability <b>→</b></span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
