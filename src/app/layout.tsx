import type { Metadata } from "next";
import AuthShell from "@/components/auth-shell";
import DriftScanner from "@/components/drift-scanner";
import ProposalGuard from "@/components/proposal-guard";
import PatternIntelligence from "@/components/pattern-intelligence";
import DecisionReplay from "@/components/decision-replay";
import ContradictionRadar from "@/components/contradiction-radar";
import DecisionTrustScore from "@/components/decision-trust-score";
import DecisionShockwave from "@/components/decision-shockwave";
import "./globals.css";

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
            <ProposalGuard />
            <DecisionShockwave />
            <PatternIntelligence />
            <DecisionTrustScore decisionKey="DEC-021" />
            <ContradictionRadar />
            <div style={{ position: "fixed", right: 22, bottom: 96, zIndex: 65, width: 238 }}>
              <DecisionReplay decisionKey="DEC-021" />
            </div>
            <DriftScanner />
          </>
        </AuthShell>
      </body>
    </html>
  );
}
