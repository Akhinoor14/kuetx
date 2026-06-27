// Inline SVG background — avoids id conflicts when used in multiple components
// Usage: import { heroBgDataUri } from '../assets/profileHeroBg';
// Then: backgroundImage: `linear-gradient(...), url(${heroBgDataUri})`

const svgContent = `<svg width="100%" viewBox="0 0 970 970" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="kx-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="%231a3a1f" stroke-width="0.7"/>
    </pattern>
    <radialGradient id="kx-g1" cx="28%" cy="38%" r="55%">
      <stop offset="0%" stop-color="%231e6b30" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="%230a1f0f" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="kx-g2" cx="72%" cy="68%" r="50%">
      <stop offset="0%" stop-color="%230f3d1a" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="%230a1f0f" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="kx-g3" cx="55%" cy="20%" r="35%">
      <stop offset="0%" stop-color="%231a5228" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="%230a1f0f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="970" height="970" fill="%230a1f0f"/>
  <rect x="0" y="0" width="970" height="970" fill="url(%23kx-grid)"/>
  <rect x="0" y="0" width="970" height="970" fill="url(%23kx-g1)"/>
  <rect x="0" y="0" width="970" height="970" fill="url(%23kx-g2)"/>
  <rect x="0" y="0" width="970" height="970" fill="url(%23kx-g3)"/>
</svg>`;

export const heroBgDataUri = `data:image/svg+xml,${svgContent}`;
