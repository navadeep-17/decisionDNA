import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DecisionDNA",
  description: "Organizational decision memory powered by Hindsight",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
