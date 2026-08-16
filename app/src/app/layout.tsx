import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { loadDemoMeta } from "@/lib/demo-data";
import { formatDate } from "@/lib/analytics";

export const metadata: Metadata = {
  title: {
    default: "Customer Resolution Intelligence",
    template: "%s · Customer Resolution Intelligence",
  },
  description:
    "Understand what customers are experiencing, find what is changing, and decide what needs attention.",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/data-story", label: "Data Story" },
  { href: "/insights", label: "Insights" },
  { href: "/explore", label: "Explore" },
  { href: "/decisions", label: "Decisions" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = await loadDemoMeta();

  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <header className="site-header">
          <nav className="container site-nav" aria-label="Primary">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                CRI
              </span>
              Customer Resolution Intelligence
            </Link>
            <div className="nav-links">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
            {meta.generated_at_utc !== "unset" && (
              <div className="nav-meta">Updated {formatDate(meta.generated_at_utc)}</div>
            )}
          </nav>
        </header>

        <main id="main-content">{children}</main>

        <footer className="site-footer">
          <div className="container footer-inner">
            <span>
              Built on the public CFPB Consumer Complaint Database
              {meta.source_retrieval_date
                ? ` · Retrieved ${formatDate(meta.source_retrieval_date)}`
                : ""}
            </span>
            <span className="footer-links">
              <Link href="/methodology">Methodology</Link>
              <a href="https://www.consumerfinance.gov/data-research/consumer-complaints/">
                Data source
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
