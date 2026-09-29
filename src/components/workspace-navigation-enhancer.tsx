"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SECTION_IDS = ["overview", "ingest", "decisions", "ask", "timeline", "memory"];

export default function WorkspaceNavigationEnhancer() {
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".navList");
    if (nav) setNavTarget(nav);

    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('.navList a[href^="#"]'));
    const sections = SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    function activate(id: string) {
      anchors.forEach((anchor) => {
        const active = anchor.getAttribute("href") === `#${id}`;
        anchor.classList.toggle("active", active);
        if (active) anchor.setAttribute("aria-current", "page");
        else anchor.removeAttribute("aria-current");
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) activate(visible.target.id);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0.05, 0.15, 0.3, 0.55] },
    );

    sections.forEach((section) => observer.observe(section));
    activate(window.location.hash.replace("#", "") || "overview");

    return () => observer.disconnect();
  }, []);

  if (!navTarget) return null;

  return createPortal(
    <>
      <div className="navDivider" aria-hidden="true" />
      <button
        className="navItem navUtilityItem"
        type="button"
        onClick={() => window.dispatchEvent(new Event("decisiondna:open-intelligence"))}
      >
        <span>✦</span>
        Intelligence
      </button>
    </>,
    navTarget,
  );
}
