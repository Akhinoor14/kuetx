#!/usr/bin/env pwsh
<#
.SYNOPSIS
    CSS Architecture Migration Setup Script
    
.DESCRIPTION
    Creates the new CSS folder structure and provides guidance for migration
    
.EXAMPLE
    .\scripts\setup-css-architecture.ps1
#>

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        KUETx CSS Architecture Setup                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$baseDir = "src/styles"
$folders = @(
    "$baseDir/base",
    "$baseDir/components",
    "$baseDir/pages",
    "$baseDir/responsive",
    "$baseDir/themes"
)

# Create directories
Write-Host "📁 Creating folder structure..." -ForegroundColor Yellow
foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Write-Host "   ✅ Created: $folder"
    } else {
        Write-Host "   ⏭️  Already exists: $folder"
    }
}

# Create template files
Write-Host ""
Write-Host "📝 Creating template files..." -ForegroundColor Yellow

$templates = @{
    "$baseDir/base/variables.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* CSS VARIABLES - Theme & Design Tokens */
/* ──────────────────────────────────────────────────────────────────── */

:root {
  --bg:       #f5f5f2;
  --surface:  #ffffff;
  --card:     #ffffff;
  --border:   #e2e0db;
  --text:     #1c1c1a;
  --muted:    #6b6860;
  --accentRGB: 22, 163, 74;
  --accent:   #16a34a;
  --accent2:  #0ea5e9;
  --accentSoft: #dcfce7;
  --accentFg: #ffffff;
  --danger:   #dc2626;
  --warning:  #d97706;
  --success:  #16a34a;
  --inputBg:  #f8f8f6;
  --surfaceGlassStrong: rgba(255, 255, 255, 0.96);
  --surfaceGlass: rgba(255, 255, 255, 0.78);
  --surfaceGlassSoft: rgba(255, 255, 255, 0.56);
  --dangerBg: #fff1f1;
  --warningBg: #fffbeb;
  --successBg: #f0fdf4;
  --r:        12px;
  color-scheme: light;
}
"@

    "$baseDir/base/reset.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* HTML Reset & Normalization */
/* ──────────────────────────────────────────────────────────────────── */

html, body {
  font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans', 'Helvetica Neue', Arial;
  margin: 0;
  padding: 0;
}
"@

    "$baseDir/base/typography.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* TYPOGRAPHY - Global Font Rules */
/* ──────────────────────────────────────────────────────────────────── */

h1 { font-size: 28px; font-weight: 700; line-height: 1.2; }
h2 { font-size: 24px; font-weight: 700; line-height: 1.3; }
h3 { font-size: 20px; font-weight: 600; line-height: 1.4; }
h4 { font-size: 16px; font-weight: 600; line-height: 1.5; }
p { font-size: 14px; line-height: 1.6; }

@media (max-width: 768px) {
  h1 { font-size: 22px; }
  h2 { font-size: 18px; }
  h3 { font-size: 16px; }
}
"@

    "$baseDir/base/animations.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* ANIMATIONS & TRANSITIONS */
/* ──────────────────────────────────────────────────────────────────── */

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

* {
  transition: background-color 0.2s ease, color 0.2s ease;
}
"@

    "$baseDir/components/buttons.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* BUTTON COMPONENTS */
/* ──────────────────────────────────────────────────────────────────── */

.btn {
  padding: 10px 16px;
  border-radius: var(--r);
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--accent);
  color: var(--accentFg);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-danger {
  background: var(--danger);
  color: white;
}
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
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
"@

    "$baseDir/responsive/mobile.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* MOBILE UTILITIES (<640px) */
/* ──────────────────────────────────────────────────────────────────── */

@media (max-width: 639px) {
  .hide-mobile {
    display: none !important;
  }
  
  .mobile-full {
    width: 100%;
  }
}
"@

    "$baseDir/responsive/tablet.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* TABLET UTILITIES (640px - 1024px) */
/* ──────────────────────────────────────────────────────────────────── */

@media (min-width: 640px) and (max-width: 1023px) {
  .hide-tablet {
    display: none !important;
  }
}
"@

    "$baseDir/responsive/desktop.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* DESKTOP UTILITIES (>1024px) */
/* ──────────────────────────────────────────────────────────────────── */

@media (min-width: 1024px) {
  .hide-desktop {
    display: none !important;
  }
}
"@

    "$baseDir/themes/light.css" = @"
/* ──────────────────────────────────────────────────────────────────── */
/* LIGHT THEME - Variable Overrides */
/* ──────────────────────────────────────────────────────────────────── */

/* Light theme is default - variables defined in base/variables.css */
"@
}

foreach ($file in $templates.Keys) {
    if (-not (Test-Path $file)) {
        $content = $templates[$file]
        Set-Content -Path $file -Value $content -Encoding UTF8
        Write-Host "   ✅ Created: $file"
    } else {
        Write-Host "   ⏭️  Already exists: $file"
    }
}

Write-Host ""
Write-Host "✨ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Review the CSS Architecture Plan:"
Write-Host "     📄 CSS_ARCHITECTURE_PLAN.md" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Extract page-specific styles:"
Write-Host "     🐍 python scripts/extract_page_css.py Dashboard Courses Attendance" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Update src/index.css with the @import statements from the plan"
Write-Host ""
Write-Host "  4. Test and verify:"
Write-Host "     npm run build" -ForegroundColor Gray
Write-Host "     npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "  • Mobile first: Use @media (min-width: ...) for responsive" -ForegroundColor Gray
Write-Host "  • Naming: Use kebab-case for CSS classes" -ForegroundColor Gray
Write-Host "  • Variables: Always use --css-vars from base/variables.css" -ForegroundColor Gray
Write-Host ""
