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
  { id: "gaps", mountId: "tool-knowledge-gaps", icon: "?", title: "Knowledge Gaps", subtitle: "See what evidence is still missing.", category: "Before decision", recommended: true },
  { id: "proposal", mountId: "tool-proposal-guard", icon: "↺", title: "Prior Attempts", subtitle: "Check whether the organization tried this before.", category: "Before decision" },
  { id: "contract", mountId: "tool-decision-contract", icon: "§", title: "Decision Contract", subtitle: "Inspect assumptions and reversal conditions.", category: "Decision health", recommended: true },
  { id: "trust", mountId: "tool-trust-score", icon: "%", title: "Trust Score", subtitle: "See how trustworthy the rationale is today.", category: "Decision health" },
  { id: "drift", mountId: "tool-drift-scanner", icon: "∆", title: "Decision Drift", subtitle: "Find decisions whose context has changed.", category: "Decision health", recommended: true },
  { id: "replay", mountId: "tool-decision-replay", icon: "◷", title: "Time Travel", subtitle: "Compare what the team knew then versus now.", category: "Memory quality", recommended: true },
  { id: "shockwave", mountId: "tool-shockwave", icon: "◎", title: "Shockwave", subtitle: "Trace what one new memory affects downstream.", category: "Memory quality", recommended: true },
  { id: "contradictions", mountId: "tool-contradictions", icon: "≠", title: "Contradictions", subtitle: "Separate conflicts from normal decision evolution.", category: "Memory quality" },
  { id: "patterns", mountId: "tool-patterns", icon: "✦", title: "Patterns", subtitle: "Surface recurring lessons across organizational memory.", category: "Org learning" },
];

const categories = [
  { name: "Before decision" as const, label: "Before a decision", description: "Understand what history already knows before committing." },
  { name: "Decision health" as const, label: "Decision health", description: "Check whether an existing decision is still supported." },
  { name: "Memory quality" as const, label: "Memory quality", description: "Inspect change, conflict, and downstream impact." },
  { name: "Org learning" as const, label: "Organization learning", description: "Turn remembered history into reusable lessons." },
];

function launchMountedTool(mountId: string) {
  document.querySelector<HTMLButtonElement>(`#${mountId} > button`)?.click();
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
      <button id="intelligence-center-launcher" className={styles.launcher} type="button" onClick={() => setOpen(true)} aria-label="Open Intelligence Center">
        <span className={styles.launcherIcon}>✦</span>
        <span className={styles.launcherCopy}><strong>Intelligence Center</strong><small>Explore organizational memory</small></span>
        <span className={styles.launcherArrow}>Open</span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={() => setOpen(false)}>
          <section className={styles.panel} onMouseDown={(event) => event.stopPropagation()} aria-label="DecisionDNA Intelligence Center">
            <header className={styles.header}>
              <div>
                <p className={styles.productEyebrow}>DECISIONDNA · ORGANIZATIONAL MEMORY</p>
                <h2>Intelligence Center</h2>
                <span>Open the capability you need for the current decision.</span>
              </div>
              <button className={styles.closeButton} type="button" onClick={() => setOpen(false)} aria-label="Close Intelligence Center">×</button>
            </header>

            <div className={styles.centerBody}>
              <section className={styles.centerHero}>
                <div>
                  <p className={styles.eyebrow}>DECISION LIFECYCLE</p>
                  <h3>Understand the evidence. Revisit the reasoning. Learn from what changed.</h3>
                  <p>Nine focused capabilities, each grounded in remembered organizational context.</p>
                </div>
              </section>

              {categories.map((category) => {
                const categoryTools = tools.filter((tool) => tool.category === category.name);
                return (
                  <section className={styles.category} key={category.name}>
                    <div className={styles.categoryHeader}>
                      <div><span>{category.label.toUpperCase()}</span><p>{category.description}</p></div>
                      <small>{categoryTools.length} {categoryTools.length === 1 ? "tool" : "tools"}</small>
                    </div>
                    <div className={styles.toolGrid}>
                      {categoryTools.map((tool) => (
                        <button type="button" className={styles.toolCard} key={tool.id} onClick={() => launchTool(tool.id)}>
                          <div className={styles.toolTopline}><span className={styles.toolIcon}>{tool.icon}</span>{tool.recommended ? <span className={styles.coreBadge}>CORE</span> : null}</div>
                          <strong>{tool.title}</strong>
                          <p>{tool.subtitle}</p>
                          <span className={styles.openLabel}>Open <b>→</b></span>
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
