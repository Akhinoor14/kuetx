/**
 * Premium-style verification badge — a scalloped (8-point) badge shape
 * rather than a plain circle, with a subtle gradient + soft shadow so it
 * reads as a deliberate "verified" mark rather than a flat status dot.
 * This is the ONE badge for "this person's KUET identity is confirmed" —
 * whether that confirmation came from Tier 1 (automatic @stud.kuet.ac.bd
 * email proof) or Tier 2 (manual CL/CR approval), the visitor doesn't
 * need to know which; both mean the same thing: this really is who they
 * say they are.
 *
 * size: pixel size of the badge. title: tooltip text.
 */
export default function BlueTick({ size = 14, title = 'Verified KUET student' }) {
  const box = size + 6;
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: box, height: box, flexShrink: 0, lineHeight: 0,
        filter: 'drop-shadow(0 1px 2px rgba(14,120,214,0.45))',
      }}
    >
      <svg width={box} height={box} viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bluetick-grad" x1="0" y1="0" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4fb3ff" />
            <stop offset="55%" stopColor="#1d9bf0" />
            <stop offset="100%" stopColor="#0a6dc2" />
          </linearGradient>
        </defs>
        <path
          fill="url(#bluetick-grad)"
          d="M11 0.8 L13.35 2.55 L16.25 2.05 L17.2 4.8 L19.95 5.75 L19.45 8.65 L21.2 11 L19.45 13.35 L19.95 16.25 L17.2 17.2 L16.25 19.95 L13.35 19.45 L11 21.2 L8.65 19.45 L5.75 19.95 L4.8 17.2 L2.05 16.25 L2.55 13.35 L0.8 11 L2.55 8.65 L2.05 5.75 L4.8 4.8 L5.75 2.05 L8.65 2.55 Z"
        />
        <path
          d="M6.5 11.3 L9.4 14.2 L15.5 8"
          stroke="white"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
