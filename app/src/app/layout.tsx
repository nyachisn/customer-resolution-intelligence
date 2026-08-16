import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Customer Resolution Intelligence",
  description:
    "A trusted decision layer for customer-issue operations — an independent portfolio prototype built on public CFPB data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <header className="site-header">
          <nav className="container site-nav" aria-label="Primary">
            <Link href="/" className="brand">
              Customer Resolution Intelligence
            </Link>
            <Link href="/demo/operations">Operations overview</Link>
            <Link href="/demo/investigation">Issue investigation</Link>
            <Link href="/demo/context">Complaint record context</Link>
            <Link href="/methodology">Methodology</Link>
            <Link href="/assessment">Request an assessment</Link>
          </nav>
        </header>
        <main id="main-content" className="container">
          {children}
        </main>
        <footer className="site-footer">
          <div className="container">
            <p>
              Independent portfolio prototype. Not affiliated with, endorsed
              by, or connected to the CFPB, any financial institution, or
              Twilio. Source:{" "}
              <a href="https://www.consumerfinance.gov/data-research/consumer-complaints/">
                CFPB Consumer Complaint Database
              </a>
              .{" "}
              <Link href="/methodology">Methodology &amp; limitations</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
