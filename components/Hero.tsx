export default function Hero({ docked }: { docked: boolean }) {
  return (
    <div className={`hero${docked ? " hero--docked" : ""}`}>
      {/* Two layers so the shrink and the travel can be timed separately:
          docking = shrink first, then rise. Undocking reverses the order. */}
      <div className="hero__travel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero__logo" src="/assets/logo.png" alt="Seedhe Maut" draggable={false} />
      </div>
    </div>
  );
}
