"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function launchMountedTool(mountId: string) {
  document.querySelector<HTMLButtonElement>(`#${mountId} > button`)?.click();
}

export default function ProductExperienceEnhancer() {
  const [decisionMain, setDecisionMain] = useState<Element | null>(null);
  const [decisionAside, setDecisionAside] = useState<Element | null>(null);
  const [impactFooter, setImpactFooter] = useState<Element | null>(null);

  useEffect(() => {
    const syncTargets = () => {
      setDecisionMain(document.querySelector(".decisionMain"));
      setDecisionAside(document.querySelector(".decisionAside"));
      setImpactFooter(document.querySelector(".impactCard.learned .impactFooter"));
    };

    syncTargets();
    const observer = new MutationObserver(syncTargets);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {decisionMain
        ? createPortal(
            <div className="decisionSignalBar" aria-label="DEC-021 decision signals">
              <span><b>Review</b> suggested</span>
              <span><b>Context</b> changed</span>
              <span><b>Human</b> decision required</span>
            </div>,
            decisionMain,
          )
        : null}

      {decisionAside
        ? createPortal(
            <div className="decisionContextTools" aria-label="DEC-021 intelligence actions">
              <p>Inspect this decision</p>
              <div>
                <button type="button" onClick={() => launchMountedTool("tool-decision-contract")}>Contract</button>
                <button type="button" onClick={() => launchMountedTool("tool-decision-replay")}>Replay</button>
                <button type="button" onClick={() => launchMountedTool("tool-trust-score")}>Trust</button>
              </div>
            </div>,
            decisionAside,
          )
        : null}

      {impactFooter
        ? createPortal(
            <button
              type="button"
              className="secondaryBtn memoryShockwaveAction"
              onClick={() => launchMountedTool("tool-shockwave")}
            >
              View shockwave
            </button>,
            impactFooter,
          )
        : null}
    </>
  );
}
