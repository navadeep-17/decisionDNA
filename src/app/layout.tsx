import type { Metadata } from "next";
import AuthShell from "@/components/auth-shell";
import DriftScanner from "@/components/drift-scanner";
import ProposalGuard from "@/components/proposal-guard";
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
            <DriftScanner />
          </>
        </AuthShell>
      </body>
    </html>
  );
}
