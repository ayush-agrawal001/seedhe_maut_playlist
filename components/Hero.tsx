const X_URL = "https://x.com/bunnyTheRobo001";
const IG_URL = "https://www.instagram.com/bunnytherobo";

export default function Hero({ docked }: { docked: boolean }) {
  return (
    <div className={`hero${docked ? " hero--docked" : ""}`}>
      {/* Two layers so the shrink and the travel can be timed separately:
          docking = shrink first, then rise. Undocking reverses the order. */}
      <div className="hero__travel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero__logo" src="/assets/logo.png" alt="Seedhe Maut" draggable={false} />
      </div>

      {/* Sits inside .hero so the flex centring accounts for it, rather than
          being pinned at a magic offset that breaks as the logo scales. */}
      <div className="madeby">
        <span className="madeby__label">built by</span>
        <a
          className="madeby__link"
          href={X_URL}
          target="_blank"
          rel="noopener noreferrer me"
          aria-label="Ayush on X (opens in a new tab)"
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path
              d="M17.53 3h3.03l-6.62 7.57L21.75 21h-5.9l-4.62-6.04L5.94 21H2.9l7.08-8.09L2.5 3h6.05l4.18 5.52L17.53 3Zm-1.06 16.13h1.68L7.6 4.78H5.8l10.67 14.35Z"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          bunnyTheRobo001
        </a>
        <span className="madeby__dot" aria-hidden>
          ·
        </span>
        <a
          className="madeby__link"
          href={IG_URL}
          target="_blank"
          rel="noopener noreferrer me"
          aria-label="Ayush on Instagram (opens in a new tab)"
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
          </svg>
          bunnytherobo
        </a>
      </div>
    </div>
  );
}
