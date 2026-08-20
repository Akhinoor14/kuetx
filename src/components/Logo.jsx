// KUETx Turtle Mascot Logo — sleeping turtle with a nightcap, hugging a pillow
// Uses the real mascot artwork (public/icon-512.png). The artwork itself
// already has rounded corners + a glossy highlight baked in, so we don't
// re-round it here — that used to cause visible double-rounded corners.
// Same Logo({size}) / Wordmark({height}) API as before, so every call site
// (Sidebar, Navbar, Footer, About) keeps working unchanged.

// Pick the smallest icon asset that still looks crisp at the requested
// pixel size, so small nav/footer logos don't download the 512px image.
function iconSrcFor(px) {
  if (px <= 40) return '/icon-192.png';
  return '/icon-512.png';
}

export function Logo({ size = 32 }) {
  return (
    <img
      src={iconSrcFor(size)}
      width={size}
      height={size}
      alt="KUETx"
      style={{ display: 'block' }}
    />
  );
}

// Horizontal wordmark: turtle icon + KUETx text.
// The icon is sized larger than the text's own line-height (1.7x `height`
// instead of 1:1) so the turtle mascot — the actual brand identifier — is
// clearly visible instead of shrinking to an illegible dot next to the
// text. Text baseline size (`height`-driven) is unchanged so this doesn't
// blow up the navbar row height, only the icon.
// `theme="kx"` pins the wordmark to the kx-* landing-page palette
// explicitly (matches the mockup's `.nav-brand span { color: var(--kx-accent) }`)
// instead of relying on inheriting a remapped --text/--accent from an
// ancestor .kx-theme-vars wrapper. Every other call site (Sidebar, Footer,
// About, etc.) omits the prop and keeps using the app's real --text/--accent,
// unchanged.
export function Wordmark({ height = 28, theme }) {
  const iconPx = Math.round(height * 1.5);
  // 'kx' pins to the landing page's light-surface palette (--kx-ink/
  // --kx-accent). 'dark' is for placements on a dark background (e.g.
  // Footer's dark CTA band) where --text/--kx-ink are the wrong,
  // near-black colors and would be unreadable — this uses the same
  // off-white/bright-green pair the rest of the dark hero UI uses.
  // Anything else falls back to the app's normal --text/--accent.
  let textColor;
  let accentColor;
  if (theme === 'kx') {
    textColor = 'var(--kx-ink)';
    accentColor = 'var(--kx-accent)';
  } else if (theme === 'dark') {
    textColor = '#f3f4ef';
    accentColor = 'var(--kx-accent-bright, #a3e635)';
  } else {
    textColor = 'var(--text)';
    accentColor = 'var(--accent)';
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.22 }}>
      <img
        src={iconSrcFor(iconPx)}
        width={iconPx}
        height={iconPx}
        alt="KUETx"
        style={{ display: 'block', flexShrink: 0, marginBlock: -(iconPx - height) / 2 }}
      />
      <span
        style={{
          fontFamily: "'Sora', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: height * 0.95,
          letterSpacing: '-0.5px',
          lineHeight: 1,
          color: textColor,
        }}
      >
        KUET<span style={{ color: accentColor }}>x</span>
      </span>
    </span>
  );
}
