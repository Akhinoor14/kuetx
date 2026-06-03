#!/usr/bin/env pwsh
<#
.SYNOPSIS
    KUETx CSS Structure Setup - Auto-Split Ready
    
.DESCRIPTION
    Creates the CSS folder structure matching user preference:
    - base/    (reset, themes, typography)
    - components/ (buttons, cards, inputs, etc)
    - pages/   (individual page files)
    - utils/   (animations, layout, pwa)
    
.NOTES
    After running this, use:
    python scripts/auto-split-css.py
    
.EXAMPLE
    .\scripts\setup-css-structure-v2.ps1
#>

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   KUETx CSS Structure Setup (Auto-Split Ready)             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$baseDir = "src/styles"

# Directory structure to create
$dirs = @(
    "$baseDir/base",
    "$baseDir/components",
    "$baseDir/pages",
    "$baseDir/utils"
)

# Create directories
Write-Host "📁 Creating folder structure..." -ForegroundColor Yellow
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   ✅ $dir"
    } else {
        Write-Host "   ⏭️  $dir (already exists)"
    }
}

# Create template files with clear structure
Write-Host ""
Write-Host "📝 Creating template files..." -ForegroundColor Yellow

$templates = @{
    "$baseDir/base/reset.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* RESET & BASE HTML STYLES */
/* ──────────────────────────────────────────────────────────────────── */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
}

/* Images & Media */
img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
}

button {
  cursor: pointer;
  border: none;
}

/* Links */
a {
  color: var(--accent);
  text-decoration: none;
}

a:hover {
  opacity: 0.8;
}
"@

    "$baseDir/base/themes.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* THEME VARIABLES & COLOR SCHEME */
/* ──────────────────────────────────────────────────────────────────── */

:root {
  /* Primary Colors */
  --text:     #1c1c1a;
  --bg:       #f5f5f2;
  --surface:  #ffffff;
  --card:     #ffffff;
  --border:   #e2e0db;
  --muted:    #6b6860;

  /* Accent Colors */
  --accent:   #16a34a;
  --accent2:  #0ea5e9;
  --accentSoft: #dcfce7;
  --accentFg: #ffffff;
  --accentRGB: 22, 163, 74;

  /* Status Colors */
  --danger:   #dc2626;
  --warning:  #d97706;
  --success:  #16a34a;
  
  /* Backgrounds */
  --inputBg:  #f8f8f6;
  --dangerBg: #fff1f1;
  --warningBg: #fffbeb;
  --successBg: #f0fdf4;
  
  /* Glass & Translucent */
  --surfaceGlassStrong: rgba(255, 255, 255, 0.96);
  --surfaceGlass: rgba(255, 255, 255, 0.78);
  --surfaceGlassSoft: rgba(255, 255, 255, 0.56);

  /* UI Sizing */
  --r: 12px;
  
  color-scheme: light;
}

/* Dark Mode (Optional) */
@media (prefers-color-scheme: dark) {
  :root {
    --text:     #f5f5f2;
    --bg:       #1c1c1a;
    --surface:  #2d2d2b;
    --card:     #3a3a38;
    --border:   #4a4a48;
    --muted:    #9a9a98;
    --inputBg:  #1f1f1d;
    
    --dangerBg: #3d1f1f;
    --warningBg: #3d2f1f;
    --successBg: #1f3d1f;
  }
}
"@

    "$baseDir/base/typography.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* TYPOGRAPHY - HEADINGS & TEXT */
/* ──────────────────────────────────────────────────────────────────── */

h1, h2, h3, h4, h5, h6 {
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 0.5em;
  color: var(--text);
}

h1 { font-size: 32px; }
h2 { font-size: 28px; }
h3 { font-size: 24px; }
h4 { font-size: 20px; }
h5 { font-size: 16px; }
h6 { font-size: 14px; }

p {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 1em;
  color: var(--text);
}

small {
  font-size: 12px;
  color: var(--muted);
}

/* Responsive Typography */
@media (max-width: 768px) {
  h1 { font-size: 24px; }
  h2 { font-size: 20px; }
  h3 { font-size: 18px; }
  h4 { font-size: 16px; }
  p { font-size: 13px; }
}
"@

    "$baseDir/components/buttons.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* BUTTON COMPONENTS */
/* ──────────────────────────────────────────────────────────────────── */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--r);
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: var(--accentFg);
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(0.9);
  box-shadow: 0 4px 12px rgba(var(--accentRGB), 0.3);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--inputBg);
  border-color: var(--accent);
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  filter: brightness(0.9);
}

.btn-sm { padding: 8px 12px; font-size: 12px; }
.btn-lg { padding: 14px 24px; font-size: 16px; }
.btn-block { width: 100%; }
"@

    "$baseDir/components/cards.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* CARD COMPONENTS */
/* ──────────────────────────────────────────────────────────────────── */

.card {
  padding: 16px;
  border-radius: var(--r);
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: var(--accent);
}

.card-header {
  margin: -16px -16px 12px -16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--inputBg);
  border-radius: var(--r) var(--r) 0 0;
}

.card-body {
  padding: 0;
}

.card-footer {
  margin: 12px -16px -16px -16px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--inputBg);
  border-radius: 0 0 var(--r) var(--r);
}
"@

    "$baseDir/components/inputs.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* FORM COMPONENTS - INPUTS, SELECTS, TEXTAREAS */
/* ──────────────────────────────────────────────────────────────────── */

.form-group {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}

.form-group input,
.form-group textarea,
.form-group select {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--inputBg);
  color: var(--text);
  font-size: 14px;
  transition: all 0.2s ease;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accentRGB), 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
}

.form-group select {
  cursor: pointer;
}
"@

    "$baseDir/components/tags.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* TAGS & BADGES */
/* ──────────────────────────────────────────────────────────────────── */

.tag, .badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 600;
  background: var(--accentSoft);
  color: var(--accent);
}

.badge-danger {
  background: #fee;
  color: var(--danger);
}

.badge-warning {
  background: #fef3c7;
  color: var(--warning);
}

.badge-success {
  background: var(--successBg);
  color: var(--success);
}
"@

    "$baseDir/components/modal.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* MODAL & DRAWER COMPONENTS */
/* ──────────────────────────────────────────────────────────────────── */

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1040;
}

.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1050;
  background: var(--card);
  border-radius: var(--r);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 90%;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.modal-body {
  padding: 16px;
}

.modal-footer {
  padding: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
"@

    "$baseDir/components/progress.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* PROGRESS BARS & LOADERS */
/* ──────────────────────────────────────────────────────────────────── */

.progress {
  height: 8px;
  background: var(--inputBg);
  border-radius: 99px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 99px;
  transition: width 0.3s ease;
}

.progress-bar.danger { background: var(--danger); }
.progress-bar.warning { background: var(--warning); }
.progress-bar.success { background: var(--success); }
"@

    "$baseDir/components/nav.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* NAVIGATION - TOPBAR & BOTTOM NAV */
/* ──────────────────────────────────────────────────────────────────── */

.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.nav {
  display: flex;
  gap: 8px;
  list-style: none;
}

.nav-item {
  display: flex;
  align-items: center;
}

.nav-link {
  padding: 8px 12px;
  border-radius: var(--r);
  color: var(--text);
  transition: all 0.2s ease;
}

.nav-link:hover, .nav-link.active {
  background: var(--accentSoft);
  color: var(--accent);
}

/* Mobile Bottom Nav */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.1);
}

.bottom-nav-item {
  flex: 1;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bottom-nav-item.active {
  color: var(--accent);
}
"@

    "$baseDir/utils/animations.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* ANIMATIONS & KEYFRAMES */
/* ──────────────────────────────────────────────────────────────────── */

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Utility Animation Classes */
.animate-fadeIn { animation: fadeIn 0.3s ease; }
.animate-slideInUp { animation: slideInUp 0.3s ease; }
.animate-slideInDown { animation: slideInDown 0.3s ease; }
.animate-spin { animation: spin 1s linear infinite; }
.animate-pulse { animation: pulse 2s ease-in-out infinite; }
"@

    "$baseDir/utils/layout.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* LAYOUT HELPERS - GRIDS, FLEXBOX, CONTAINERS */
/* ──────────────────────────────────────────────────────────────────── */

.page-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px;
}

.grid {
  display: grid;
  gap: 16px;
}

.grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 768px) {
  .grid-2, .grid-3 {
    grid-template-columns: 1fr;
  }
}

.flex {
  display: flex;
  gap: 8px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Spacing Utilities */
.mt-1 { margin-top: 4px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }

.mb-1 { margin-bottom: 4px; }
.mb-2 { margin-bottom: 8px; }
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 16px; }

.p-1 { padding: 4px; }
.p-2 { padding: 8px; }
.p-3 { padding: 12px; }
.p-4 { padding: 16px; }
"@

    "$baseDir/utils/pwa.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* PWA SPECIFIC - INSTALL BUTTON, PROMPTS */
/* ──────────────────────────────────────────────────────────────────── */

.pwa-install-btn {
  padding: 10px 16px;
  background: var(--accent);
  color: var(--accentFg);
  border: none;
  border-radius: var(--r);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pwa-install-btn:hover {
  filter: brightness(0.9);
}

.pwa-install-prompt {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 999;
  max-width: 300px;
}

.pwa-install-prompt-close {
  float: right;
  cursor: pointer;
  font-size: 20px;
  color: var(--muted);
}
"@

    "$baseDir/index.css" = @"
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ──────────────────────────────────────────────────────────────────── */
/* BASE STYLES - Shared across entire app */
/* ──────────────────────────────────────────────────────────────────── */
@import './base/reset.css';
@import './base/themes.css';
@import './base/typography.css';

/* ──────────────────────────────────────────────────────────────────── */
/* COMPONENT STYLES - Reusable components */
/* ──────────────────────────────────────────────────────────────────── */
@import './components/buttons.css';
@import './components/cards.css';
@import './components/inputs.css';
@import './components/tags.css';
@import './components/modal.css';
@import './components/progress.css';
@import './components/nav.css';

/* ──────────────────────────────────────────────────────────────────── */
/* UTILITY STYLES - Layout, animations, PWA */
/* ──────────────────────────────────────────────────────────────────── */
@import './utils/animations.css';
@import './utils/layout.css';
@import './utils/pwa.css';

/* ──────────────────────────────────────────────────────────────────── */
/* PAGE STYLES - Individual page files */
/* ──────────────────────────────────────────────────────────────────── */
/* Auto-imported by auto-split-css.py script - pages/*.css */
"@
}

foreach ($file in $templates.Keys) {
    if (-not (Test-Path $file)) {
        $content = $templates[$file]
        Set-Content -Path $file -Value $content -Encoding UTF8 -Force
        Write-Host "   ✅ $file"
    } else {
        Write-Host "   ⏭️  $file (already exists)"
    }
}

Write-Host ""
Write-Host "✨ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 NEXT STEPS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1️⃣  Auto-split your current CSS into organized files:"
Write-Host "      python scripts/auto-split-css.py" -ForegroundColor Gray
Write-Host ""
Write-Host "  2️⃣  This will create:"
Write-Host "      src/styles/pages/*.css (auto-detected from selectors)" -ForegroundColor Gray
Write-Host "      All imports added to src/styles/index.css" -ForegroundColor Gray
Write-Host ""
Write-Host "  3️⃣  Build and test:"
Write-Host "      npm run build" -ForegroundColor Gray
Write-Host "      npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  4️⃣  If everything looks good:"
Write-Host "      Delete or backup the old unorganized CSS" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 Structure created:" -ForegroundColor Cyan
Write-Host "   src/styles/" -ForegroundColor Yellow
Write-Host "   ├── base/ (reset, themes, typography)" -ForegroundColor Gray
Write-Host "   ├── components/ (7 component files)" -ForegroundColor Gray
Write-Host "   ├── pages/ (auto-generated by script)" -ForegroundColor Gray
Write-Host "   ├── utils/ (animations, layout, pwa)" -ForegroundColor Gray
Write-Host "   └── index.css (imports only)" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Pro Tips:" -ForegroundColor Cyan
Write-Host "   • The auto-split script detects page selectors like .dashboard-, .courses-" -ForegroundColor Gray
Write-Host "   • Components get mapped automatically to components/*.css" -ForegroundColor Gray
Write-Host "   • Duplicates are removed during splitting" -ForegroundColor Gray
Write-Host "   • Media queries stay with their rules" -ForegroundColor Gray
Write-Host ""
