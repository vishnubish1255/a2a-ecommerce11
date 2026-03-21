import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A2A Agentic Commerce | Algorand",
  description:
    "Agent-to-Agent Commerce Framework — AI agents discover services, negotiate prices, and execute blockchain payments autonomously.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#0a0a0f]">
        {children}
      </body>
    </html>
  );
}
