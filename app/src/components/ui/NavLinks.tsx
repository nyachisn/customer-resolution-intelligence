"use client";

/**
 * Primary navigation, with the current route marked.
 *
 * The three routes are a progression — what the product is, how it is built,
 * then the product itself — so knowing where you are matters more here than
 * in a flat set of tabs.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <div className="nav-links">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "is-active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
