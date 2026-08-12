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

// Horizontal wordmark: turtle icon + KUETx text
export function Wordmark({ height = 28 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.28 }}>
      <img
        src={iconSrcFor(height)}
        width={height}
        height={height}
        alt="KUETx"
        style={{ display: 'block', flexShrink: 0 }}
      />
      <span
        style={{
          fontFamily: "'Sora', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: height * 0.62,
          letterSpacing: '-0.5px',
          lineHeight: 1,
          color: 'var(--text)',
        }}
      >
        KUET<span style={{ color: 'var(--accent)' }}>x</span>
      </span>
    </span>
  );
}
