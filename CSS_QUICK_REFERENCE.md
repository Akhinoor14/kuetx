# KUETx CSS Architecture - Quick Reference

## 🎯 Quick Command Reference

### Setup the new directory structure:
```bash
.\scripts\setup-css-architecture.ps1
```

### Extract styles for specific pages:
```bash
# Extract styles for Dashboard, Courses, and Attendance
python scripts/extract_page_css.py Dashboard Courses Attendance

# Extract all pages at once
python scripts/extract_page_css.py Dashboard Courses Attendance Marks Assignments ClassManagement Clubs CTQuizPlanning Diary Money Namaz Notes Profile QuestionBank QuestionBankViewer Results Schedule SelfEval SelfStudy Teachers TermQS Settings SmartScore Alerts Calculators Extras QuickAccess About
```

---

## 📋 File Structure Example

```
src/styles/
├── index.css                        # Main - only imports
├── base/
│   ├── variables.css               # :root { --colors, --sizes }
│   ├── reset.css                   # HTML normalization
│   ├── typography.css              # h1, h2, p, etc
│   └── animations.css              # @keyframes, transitions
├── components/
│   ├── buttons.css                 # .btn, .btn-primary, .btn-danger
│   ├── cards.css                   # .card, .card-header, .card-body
│   ├── modals.css                  # .modal, .modal-backdrop
│   ├── forms.css                   # .form-group, .input, .select
│   ├── alerts.css                  # .alert, .alert-success, .alert-danger
│   └── navigation.css              # .navbar, .nav-item
├── pages/
│   ├── Dashboard.css               # .dashboard-*, responsive within file
│   ├── Courses.css
│   ├── Attendance.css
│   ├── Marks.css
│   ├── Assignments.css
│   ├── ClassManagement.css
│   ├── Clubs.css
│   ├── CTQuizPlanning.css
│   ├── Diary.css
│   ├── Money.css
│   ├── Namaz.css
│   ├── Notes.css
│   ├── Profile.css
│   ├── QuestionBank.css
│   ├── QuestionBankViewer.css
│   ├── Results.css
│   ├── Schedule.css
│   ├── SelfEval.css
│   ├── SelfStudy.css
│   ├── Teachers.css
│   ├── TermQS.css
│   ├── Settings.css
│   ├── SmartScore.css
│   ├── Alerts.css
│   ├── Calculators.css
│   ├── Extras.css
│   ├── QuickAccess.css
│   └── About.css
├── responsive/
│   ├── mobile.css                  # @media (max-width: 639px)
│   ├── tablet.css                  # @media (640px - 1023px)
│   └── desktop.css                 # @media (min-width: 1024px)
└── themes/
    ├── light.css                   # Light theme variable overrides
    └── dark.css                    # Dark theme variable overrides (optional)
```

---

## ✍️ How to Write Page CSS

### Example: src/styles/pages/Dashboard.css

```css
/* ──────────────────────────────────────────────────────────────────── */
/* DASHBOARD PAGE STYLES */
/* ──────────────────────────────────────────────────────────────────── */

/* ─────── Main Container ─────── */
.dashboard-page {
  padding: 12px;
  background: var(--bg);
}

/* ─────── Hero Section ─────── */
.dashboard-hero {
  margin-bottom: 16px;
}

.dashboard-hero-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}

.dashboard-hero-subtitle {
  font-size: 13px;
  color: var(--muted);
}

/* ─────── Grid Layout ─────── */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;  /* Mobile default */
  gap: 12px;
  margin-bottom: 16px;
}

.dashboard-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.dashboard-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-color: var(--accent);
}

.dashboard-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}

.dashboard-card-content {
  font-size: 14px;
  color: var(--muted);
}

/* ─────── Stats Section ─────── */
.dashboard-stats {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.dashboard-stat {
  flex: 1;
  min-width: 60px;
  text-align: center;
}

.dashboard-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
}

.dashboard-stat-label {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}

/* ─────── Tablet (640px - 1023px) ─────── */
@media (min-width: 640px) {
  .dashboard-page {
    padding: 16px;
  }

  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .dashboard-hero-title {
    font-size: 28px;
  }

  .dashboard-card {
    padding: 20px;
  }

  .dashboard-stats {
    gap: 12px;
  }
}

/* ─────── Desktop (> 1024px) ─────── */
@media (min-width: 1024px) {
  .dashboard-page {
    padding: 24px;
  }

  .dashboard-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .dashboard-hero {
    margin-bottom: 24px;
  }

  .dashboard-hero-title {
    font-size: 32px;
  }

  .dashboard-card {
    padding: 24px;
  }

  .dashboard-stats {
    gap: 16px;
  }
}
```

---

## 🎨 How to Write Component CSS

### Example: src/styles/components/buttons.css

```css
/* ──────────────────────────────────────────────────────────────────── */
/* BUTTON COMPONENTS */
/* ──────────────────────────────────────────────────────────────────── */

/* Base Button Styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

/* Primary Button */
.btn-primary {
  background: var(--accent);
  color: var(--accentFg);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent);
  filter: brightness(0.9);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
}

/* Secondary Button */
.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--inputBg);
  border-color: var(--accent);
}

/* Danger Button */
.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: var(--danger);
  filter: brightness(0.9);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

/* Small Button */
.btn-sm {
  padding: 8px 12px;
  font-size: 12px;
}

/* Large Button */
.btn-lg {
  padding: 14px 24px;
  font-size: 16px;
}

/* Full Width */
.btn-block {
  width: 100%;
}

/* Mobile responsive */
@media (max-width: 639px) {
  .btn {
    padding: 12px 14px;
    font-size: 13px;
  }
}
```

---

## 📱 Mobile-First Approach

### ✅ CORRECT: Mobile first, then enhance

```css
.course-card {
  /* Mobile defaults (< 640px) */
  display: grid;
  grid-template-columns: 1fr;
  padding: 12px;
  font-size: 13px;
}

@media (min-width: 640px) {
  .course-card {
    /* Tablet improvements */
    grid-template-columns: repeat(2, 1fr);
    padding: 16px;
    font-size: 14px;
  }
}

@media (min-width: 1024px) {
  .course-card {
    /* Desktop improvements */
    grid-template-columns: repeat(3, 1fr);
    padding: 20px;
    font-size: 15px;
  }
}
```

### ❌ AVOID: Desktop first (outdated)

```css
/* DON'T DO THIS */
.course-card {
  grid-template-columns: repeat(3, 1fr);  /* Desktop */
}

@media (max-width: 1024px) {
  .course-card {
    grid-template-columns: repeat(2, 1fr);  /* Tablet */
  }
}

@media (max-width: 640px) {
  .course-card {
    grid-template-columns: 1fr;  /* Mobile */
  }
}
```

---

## 🎯 CSS Variable Usage

### Using CSS Variables for Consistency

```css
/* ✅ GOOD - Uses variables */
.dashboard-card {
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 16px;
  border-radius: var(--r);
}

/* ❌ AVOID - Hard-coded values */
.dashboard-card {
  background: #ffffff;
  border: 1px solid #e2e0db;
  color: #1c1c1a;
  padding: 16px;
  border-radius: 12px;
}
```

### Available Variables (from base/variables.css)

```css
:root {
  /* Colors */
  --bg:       #f5f5f2;           /* Page background */
  --surface:  #ffffff;           /* Card backgrounds */
  --card:     #ffffff;           /* Specific cards */
  --border:   #e2e0db;           /* Borders */
  --text:     #1c1c1a;           /* Primary text */
  --muted:    #6b6860;           /* Secondary text */
  
  /* Accent Colors */
  --accent:   #16a34a;           /* Primary green */
  --accent2:  #0ea5e9;           /* Secondary blue */
  --accentSoft: #dcfce7;         /* Soft green bg */
  
  /* Status Colors */
  --danger:   #dc2626;           /* Red for errors */
  --warning:  #d97706;           /* Orange for warnings */
  --success:  #16a34a;           /* Green for success */
  
  /* Backgrounds */
  --inputBg:  #f8f8f6;           /* Input field bg */
  --dangerBg: #fff1f1;           /* Danger bg */
  --warningBg: #fffbeb;          /* Warning bg */
  
  /* UI Sizes */
  --r:        12px;             /* Border radius */
}
```

---

## 🔍 Common Patterns

### Flexbox Container with Mobile Stack

```css
.flex-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

@media (max-width: 639px) {
  .flex-row {
    flex-direction: column;
    gap: 8px;
  }
}

@media (min-width: 640px) {
  .flex-row {
    flex-direction: row;
  }
}
```

### Grid with Responsive Columns

```css
.grid-auto {
  display: grid;
  grid-template-columns: 1fr;      /* Mobile: 1 column */
  gap: 12px;
}

@media (min-width: 640px) {
  .grid-auto {
    grid-template-columns: repeat(2, 1fr);  /* Tablet: 2 columns */
  }
}

@media (min-width: 1024px) {
  .grid-auto {
    grid-template-columns: repeat(3, 1fr);  /* Desktop: 3 columns */
  }
}
```

### Card with Hover Effect

```css
.card {
  padding: 16px;
  border-radius: var(--r);
  background: var(--card);
  border: 1px solid var(--border);
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-color: var(--accent);
  transform: translateY(-2px);
}
```

---

## 📝 Naming Conventions

### Use kebab-case for CSS classes:

```css
/* ✅ CORRECT */
.dashboard-page { }
.dashboard-hero-title { }
.course-card-header { }
.form-group-input { }

/* ❌ AVOID */
.DashboardPage { }
.dashboardHeroTitle { }
.courseCardHeader { }
.form_group_input { }
```

### Prefix classes with page name for isolation:

```css
/* Pages */
.dashboard-*
.courses-*
.attendance-*
.marks-*

/* Shared components */
.btn-*
.card-*
.form-*
.nav-*
```

---

## ✅ Migration Checklist

- [ ] Run `setup-css-architecture.ps1`
- [ ] Extract page styles using `extract_page_css.py`
- [ ] Create base CSS files (variables, reset, typography)
- [ ] Create component CSS files (buttons, cards, forms, etc)
- [ ] Update `src/index.css` with @import statements only
- [ ] Test each page in browser
- [ ] Verify mobile layouts (640px breakpoint)
- [ ] Verify tablet layouts (1024px breakpoint)
- [ ] Remove old CSS after verification
- [ ] Run `npm run build` and verify bundle size
- [ ] Document any custom CSS additions

---

## 🚀 Commands You'll Need

```bash
# Setup new structure
.\scripts\setup-css-architecture.ps1

# Extract specific pages
python scripts/extract_page_css.py Dashboard Courses Attendance

# Build and test
npm run build
npm run dev

# Check CSS file sizes
Get-Item src/styles/**/*.css | Select-Object Name, @{N="Size(KB)";E={$_.Length/1KB}}
```

---

## 🆘 Troubleshooting

### Q: Styles not applying after migration?
A: Check the @import order in index.css - base should load first, then components, then pages

### Q: Mobile styles not working?
A: Use mobile-first approach - default styles for mobile, then `@media (min-width: 640px)` for larger

### Q: CSS file too large?
A: Break it into smaller files - max ~5-10 KB per page file

### Q: Duplicate styles across pages?
A: Extract to `components/` folder instead - these are reusable

---

## 📚 Resources

- CSS Variables Guide: https://developer.mozilla.org/en-US/docs/Web/CSS/--*
- Mobile-First Approach: https://developer.mozilla.org/en-US/docs/Mobile/Viewport_meta_tag
- CSS Media Queries: https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries

---

**Ready to start? Run this command:** 
```bash
.\scripts\setup-css-architecture.ps1
```
