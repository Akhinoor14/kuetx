/**
 * Premium-style verification badge — an 18-point sharp star-scallop shape
 * (matching the classic Instagram/Twitter-style verified badge look), with
 * a subtle gradient + soft shadow so it reads as a deliberate "verified"
 * mark rather than a flat status dot. This is the ONE badge shape for
 * "this person's identity is confirmed" across the whole app — students
 * get the blue variant, faculty get the green variant; the shape stays
 * identical, only the gradient + shadow tint change.
 *
 * size: pixel size of the badge. title: tooltip text.
 * color: 'blue' (default, students) | 'green' (faculty).
 */
const PALETTES = {
  blue: {
    id: 'bluetick-grad',
    stops: [
      ['0%', '#4fb3ff'],
      ['55%', '#1d9bf0'],
      ['100%', '#0a6dc2'],
    ],
    shadow: 'rgba(14,120,214,0.45)',
  },
  green: {
    id: 'greentick-grad',
    stops: [
      ['0%', '#4ade80'],
      ['55%', '#16a34a'],
      ['100%', '#0e7a37'],
    ],
    shadow: 'rgba(22,163,74,0.45)',
  },
};

// 18-point star scallop (outer r=10.6, inner r=8.6, centered at 11,11 in a
// 22x22 viewBox) — deep, sharp notches like the reference badge, generated
// rather than hand-typed so the point count/depth is easy to retune.
const BADGE_PATH = 'M11.0 0.4 L12.49 2.53 L14.63 1.04 L15.3 3.55 L17.81 2.88 L17.59 5.47 '
  + 'L20.18 5.7 L19.08 8.06 L21.44 9.16 L19.6 11.0 L21.44 12.84 L19.08 13.94 '
  + 'L20.18 16.3 L17.59 16.53 L17.81 19.12 L15.3 18.45 L14.63 20.96 L12.49 19.47 '
  + 'L11.0 21.6 L9.51 19.47 L7.37 20.96 L6.7 18.45 L4.19 19.12 L4.41 16.53 '
  + 'L1.82 16.3 L2.92 13.94 L0.56 12.84 L2.4 11.0 L0.56 9.16 L2.92 8.06 '
  + 'L1.82 5.7 L4.41 5.47 L4.19 2.88 L6.7 3.55 L7.37 1.04 L9.51 2.53 Z';

export default function BlueTick({ size = 14, title = 'Verified KUET student', color = 'blue' }) {
  const box = size + 6;
  const palette = PALETTES[color] || PALETTES.blue;
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: box, height: box, flexShrink: 0, lineHeight: 0,
        filter: `drop-shadow(0 1px 2px ${palette.shadow})`,
      }}
    >
      <svg width={box} height={box} viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={palette.id} x1="0" y1="0" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            {palette.stops.map(([offset, stopColor]) => (
              <stop key={offset} offset={offset} stopColor={stopColor} />
            ))}
          </linearGradient>
        </defs>
        <path fill={`url(#${palette.id})`} d={BADGE_PATH} />
        {/* Bold, wide checkmark — thicker stroke than before so it reads
            clearly even at small badge sizes, matching the reference. */}
        <path
          d="M6.2 11.2 L9.3 14.6 L15.8 7.4"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
