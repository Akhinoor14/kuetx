// KUETx Turtle Mascot Logo — sleeping student with graduation cap
// Inspired by the Jr. KUETx favicon design

export function Logo({ size = 32 }) {
  const s = size / 64; // scale factor (base 64px)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#14532d"/>
      {/* Shell */}
      <ellipse cx="32" cy="34" rx="18" ry="16" fill="#16a34a"/>
      {/* Hex pattern */}
      <polygon points="32,22 40,27 40,35 32,40 24,35 24,27" fill="#15803d" stroke="#0f4c21" strokeWidth="1"/>
      <polygon points="32,16 40,21 40,22 32,17 24,22 24,21" fill="#0f4c21"/>
      <polygon points="15,27 24,32 24,35 15,30 12,27 15,22" fill="#0f4c21"/>
      <polygon points="40,27 49,32 49,35 40,40 40,35 40,32" fill="#0f4c21"/>
      {/* Body */}
      <ellipse cx="32" cy="46" rx="14" ry="9" fill="#a3e635"/>
      {/* Head */}
      <ellipse cx="32" cy="18" rx="8" ry="7" fill="#a3e635"/>
      {/* Sleeping eyes */}
      <path d="M27 17 Q29.5 14 32 17" stroke="#15803d" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M32 17 Q34.5 14 37 17" stroke="#15803d" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Legs */}
      <ellipse cx="19" cy="50" rx="6" ry="3" fill="#a3e635" transform="rotate(-25 19 50)"/>
      <ellipse cx="45" cy="50" rx="6" ry="3" fill="#a3e635" transform="rotate(25 45 50)"/>
      <ellipse cx="22" cy="58" rx="5.5" ry="2.5" fill="#a3e635" transform="rotate(15 22 58)"/>
      <ellipse cx="42" cy="58" rx="5.5" ry="2.5" fill="#a3e635" transform="rotate(-15 42 58)"/>
      {/* Graduation cap */}
      <rect x="24" y="12" width="16" height="4" rx="1" fill="#0f4c21"/>
      <polygon points="22,12 42,12 38,8 26,8" fill="#166534"/>
      {/* Tassel */}
      <line x1="38" y1="10" x2="44" y2="15" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="44" cy="16" r="2" fill="#fbbf24"/>
      {/* zzz */}
      <text x="46" y="15" fontFamily="Georgia,serif" fontStyle="italic" fontWeight="700" fontSize="7" fill="#4ade80" opacity="0.9">z</text>
      <text x="50" y="10" fontFamily="Georgia,serif" fontStyle="italic" fontWeight="700" fontSize="5" fill="#4ade80" opacity="0.6">z</text>
    </svg>
  );
}

// Horizontal wordmark: turtle icon + KUETx text
export function Wordmark({ height = 28 }) {
  const w = Math.round(height * 4.2);
  return (
    <svg height={height} width={w} viewBox={`0 0 ${w} ${height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Turtle icon scaled to height */}
      <g transform={`scale(${height / 64})`}>
        <rect width="64" height="64" rx="14" fill="#14532d"/>
        <ellipse cx="32" cy="34" rx="18" ry="16" fill="#16a34a"/>
        <polygon points="32,22 40,27 40,35 32,40 24,35 24,27" fill="#15803d" stroke="#0f4c21" strokeWidth="1"/>
        <polygon points="32,16 40,21 40,22 32,17 24,22 24,21" fill="#0f4c21"/>
        <ellipse cx="32" cy="46" rx="14" ry="9" fill="#a3e635"/>
        <ellipse cx="32" cy="18" rx="8" ry="7" fill="#a3e635"/>
        <path d="M27 17 Q29.5 14 32 17" stroke="#15803d" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M32 17 Q34.5 14 37 17" stroke="#15803d" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <ellipse cx="19" cy="50" rx="6" ry="3" fill="#a3e635" transform="rotate(-25 19 50)"/>
        <ellipse cx="45" cy="50" rx="6" ry="3" fill="#a3e635" transform="rotate(25 45 50)"/>
        <rect x="24" y="12" width="16" height="4" rx="1" fill="#0f4c21"/>
        <polygon points="22,12 42,12 38,8 26,8" fill="#166534"/>
        <line x1="38" y1="10" x2="44" y2="15" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="44" cy="16" r="2" fill="#fbbf24"/>
        <text x="46" y="15" fontFamily="Georgia,serif" fontStyle="italic" fontWeight="700" fontSize="7" fill="#4ade80" opacity="0.9">z</text>
      </g>
      {/* Text: KUET in --text color, x in accent */}
      <text
        x={height + 6}
        y={height * 0.73}
        fontFamily="'Sora', system-ui, sans-serif"
        fontWeight="800"
        fontSize={height * 0.62}
        letterSpacing="-0.5"
        fill="var(--text)"
      >KUET<tspan fill="var(--accent)">x</tspan></text>
    </svg>
  );
}
