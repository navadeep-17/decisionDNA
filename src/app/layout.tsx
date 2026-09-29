import type { Metadata } from "next";
import AuthShell from "@/components/auth-shell";
import DriftScanner from "@/components/drift-scanner";
import ProposalGuard from "@/components/proposal-guard";
import PatternIntelligence from "@/components/pattern-intelligence";
import DecisionReplay from "@/components/decision-replay";
import ContradictionRadar from "@/components/contradiction-radar";
import DecisionTrustScore from "@/components/decision-trust-score";
import DecisionShockwave from "@/components/decision-shockwave";
import DecisionContract from "@/components/decision-contract";
import KnowledgeGapRadar from "@/components/knowledge-gap-radar";
import IntelligenceCenter from "@/components/intelligence-center";
import "./globals.css";
import "./intelligence-center.global.css";

export const metadata: Metadata = {
  title: "DecisionDNA",
  description: "Organizational decision memory powered by Hindsight",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthShell>
          <>
            {children}

            <div id="tool-proposal-guard" className="intelligenceToolMount">
              <ProposalGuard />
            </div>
            <div id="tool-shockwave" className="intelligenceToolMount">
              <DecisionShockwave />
            </div>
            <div id="tool-knowledge-gaps" className="intelligenceToolMount">
              <KnowledgeGapRadar />
            </div>
            <div id="tool-patterns" className="intelligenceToolMount">
              <PatternIntelligence />
            </div>
            <div id="tool-decision-contract" className="intelligenceToolMount">
              <DecisionContract decisionKey="DEC-021" />
            </div>
            <div id="tool-trust-score" className="intelligenceToolMount">
              <DecisionTrustScore decisionKey="DEC-021" />
            </div>
            <div id="tool-contradictions" className="intelligenceToolMount">
              <ContradictionRadar />
            </div>
            <div id="tool-decision-replay" className="intelligenceToolMount">
              <DecisionReplay decisionKey="DEC-021" />
            </div>
            <div id="tool-drift-scanner" className="intelligenceToolMount">
              <DriftScanner />
            </div>

            <IntelligenceCenter />
          </>
        </AuthShell>
      </body>
    </html>
  );
}
