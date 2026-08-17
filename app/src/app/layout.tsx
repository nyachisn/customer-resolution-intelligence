import type { Metadata } from "next";
import Link from "next/link";
import { NavLinks } from "@/components/ui/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Customer Resolution Intelligence",
    template: "%s · Customer Resolution Intelligence",
  },
  description:
    "Understand what customers are experiencing, find what is changing, and decide what needs attention.",
};

const NAV = [
  { href: "/", label: "What" },
  { href: "/data-story", label: "How" },
  { href: "/explore", label: "Explore" },
];

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
              <span className="brand-mark" aria-hidden="true">
                CRI
              </span>
              Customer Resolution Intelligence
            </Link>
            <NavLinks items={NAV} />
          </nav>
        </header>

        <main id="main-content">{children}</main>

        <footer className="site-footer">
          <div className="container footer-inner">
            <span>Built on the public CFPB Consumer Complaint Database</span>
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
