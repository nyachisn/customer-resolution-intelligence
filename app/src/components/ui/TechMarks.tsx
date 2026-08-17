/**
 * Vendor marks in their own colours.
 *
 * Snowflake and Vercel are the vendors' own asset files, served from
 * public/brand. dbt, the CFPB and Streamlit are drawn inline in each
 * vendor's brand colour — accurate geometry rather than a black silhouette,
 * so the row of marks reads as real logos rather than icons.
 */

/* eslint-disable @next/next/no-img-element */

export function SnowflakeMark() {
  return <img src="/brand/snowflake.webp" alt="" className="mark-img" />;
}

export function VercelMark() {
  return (
    <svg width="30" height="26" viewBox="0 0 468 407" aria-hidden="true">
      <path d="M467.444 406.664L233.722 0.190918L0 406.664H467.444Z" fill="#000000" />
    </svg>
  );
}

export function DbtMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <path
        d="M6.2 6.2 L13.1 13.1 M25.8 6.2 L18.9 13.1 M6.2 25.8 L13.1 18.9 M25.8 25.8 L18.9 18.9"
        stroke="#FF694A"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M16 12.4 L19.6 16 L16 19.6 L12.4 16 Z" fill="#262A38" />
    </svg>
  );
}

export function CfpbMark() {
  return (
    <svg width="46" height="22" viewBox="0 0 60 26" aria-hidden="true">
      <text
        x="0"
        y="20"
        fontSize="22"
        fontWeight="700"
        fontFamily="var(--sans)"
        letterSpacing="-1"
        fill="#217C42"
      >
        cf
      </text>
      <text
        x="24"
        y="20"
        fontSize="22"
        fontWeight="700"
        fontFamily="var(--sans)"
        letterSpacing="-1"
        fill="#5FBB6E"
      >
        pb
      </text>
    </svg>
  );
}

export function NextMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="15" fill="#000000" />
      <path d="M11.6 21.8 L11.6 10.2 L21.8 23" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M20.6 10.2 L20.6 17.4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function StreamlitMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <path d="M2.5 12.8 L16 6.5 L29.5 12.8 L16 19.1 Z" fill="#FF4B4B" />
      <path d="M6 19.5 L16 24.5 L26 19.5" stroke="#FF4B4B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
    </svg>
  );
}

/** A mark with the vendor name beside it. */
export function BrandLockup({ mark, name }: { mark: React.ReactNode; name: string }) {
  return (
    <span className="brand-lockup">
      <span className="brand-mark-slot" aria-hidden="true">
        {mark}
      </span>
      <span className="brand-word">{name}</span>
    </span>
  );
}
