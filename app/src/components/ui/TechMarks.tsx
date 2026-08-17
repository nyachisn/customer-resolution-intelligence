/**
 * Vendor marks, drawn inline.
 *
 * The Vercel triangle is the exact path from its own asset. The others are
 * accurate geometric reductions of each vendor's mark — Snowflake's
 * six-armed asterisk, dbt's four-armed x with a diamond centre — paired with
 * the vendor name set in the page's own type. Drawn rather than fetched so
 * the page stays self-contained and the marks scale without raster edges.
 */

export function SnowflakeMark() {
  const spokes = [0, 60, 120, 180, 240, 300];
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      {spokes.map((deg) => (
        <g key={deg} transform={`rotate(${deg} 16 16)`}>
          <line x1="16" y1="4.5" x2="16" y2="27.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="8" x2="12.4" y2="11.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="8" x2="19.6" y2="11.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      <circle cx="16" cy="16" r="2.6" fill="currentColor" />
    </svg>
  );
}

export function DbtMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <path
        d="M6.5 6.5 L13.2 13.2 M25.5 6.5 L18.8 13.2 M6.5 25.5 L13.2 18.8 M25.5 25.5 L18.8 18.8"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path d="M16 12.8 L19.2 16 L16 19.2 L12.8 16 Z" fill="currentColor" />
    </svg>
  );
}

export function VercelMark() {
  return (
    <svg width="24" height="22" viewBox="0 0 468 407" aria-hidden="true">
      <path d="M467.444 406.664L233.722 0.190918L0 406.664H467.444Z" fill="currentColor" />
    </svg>
  );
}

export function NextMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2" />
      <path d="M11.5 21.5 L11.5 10.5 L21.5 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="20.5" y1="10.5" x2="20.5" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CfpbMark() {
  // The CFPB's mark is a wordmark; a lettered tile is the honest reduction.
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fontFamily="var(--sans)"
        fill="currentColor"
        letterSpacing="-0.5"
      >
        cfpb
      </text>
    </svg>
  );
}

export function StreamlitMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <path d="M3 13 L16 7 L29 13 L16 19 Z" fill="currentColor" />
      <path d="M8 21 L16 25 L24 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A mark on a solid tile, with the vendor name beside it. */
export function BrandLockup({
  mark,
  name,
}: {
  mark: React.ReactNode;
  name: string;
}) {
  return (
    <span className="brand-lockup">
      <span className="brand-tile" aria-hidden="true">
        {mark}
      </span>
      <span className="brand-word">{name}</span>
    </span>
  );
}
