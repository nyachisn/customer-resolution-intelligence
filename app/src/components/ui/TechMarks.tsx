/**
 * Simplified inline marks for the stack used in the pipeline.
 *
 * Drawn as geometry rather than fetched: the Artifact/deploy CSP blocks
 * external image hosts, and inlining keeps the page self-contained. These
 * are recognizable simplifications, not the vendors' official assets.
 */

export function SnowflakeMark() {
  const spokes = [0, 60, 120, 180, 240, 300];
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      {spokes.map((deg) => (
        <g key={deg} transform={`rotate(${deg} 16 16)`}>
          <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="16" y1="7.5" x2="12.6" y2="10.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="16" y1="7.5" x2="19.4" y2="10.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

export function DbtMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M11 21 L21 11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="11" cy="21" r="2.6" fill="currentColor" />
      <circle cx="21" cy="11" r="2.6" fill="currentColor" />
    </svg>
  );
}

export function VercelMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <path d="M16 6 L28 26 L4 26 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function NextMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 21 L12 11 L21 22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="20" y1="11" x2="20" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CfpbMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <rect x="5" y="9" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 14 H27" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 6 L16 9 L21 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="19" x2="18" y2="19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
