// founderCategories.js
//
// Single source of truth for the Founder dashboard's category structure.
// AdminDashboard's top-level grid, the CategorySubNav pill bar, and each
// category's own SubcategoryTabs are all generated FROM this array —
// nothing about the category/subcategory list is hardcoded in JSX. Add a
// category by adding an entry here; add a subcategory by adding to its
// `subcategories` array. No new component needed either way.
//
// Two subcategory shapes are supported, matching two genuinely different
// UI needs (see AdminDashboard.jsx's design note above ClassesView):
//   - `subcategories: [...]`  → static sibling sections, rendered as a
//     pill-tab row (SubcategoryTabs). Use this when a category has a
//     fixed handful of independent blocks (e.g. Trust & Safety's "Email
//     Flags" vs "Roll Unlock Requests" — neither is nested in the other).
//   - `drilldown: true`       → hierarchical path (Dept > Batch), which
//     is a breadcrumb, not a set of siblings. Rendered with its own
//     breadcrumb UI inside the category's view — SubcategoryTabs is not
//     used for these.
//
// `getCount(ctx)` returns a badge number for that category or
// subcategory. `ctx` is a plain object the dashboard builds each render
// with whatever live counts it has (approvals, trust, etc.) — see
// AdminDashboard.jsx's `buildCountCtx()`.

// PHASE 3 (SERVICE_PROVIDER_FOUNDER_PANEL_PLAN.md, Option A): the array
// order below IS the chip-row/grid order (CategorySubNav and the grid
// both render FOUNDER_CATEGORIES top-to-bottom, unmodified) — reordering
// here is the entire reorg, no new component/divider code. Grouped into
// five functional clusters so the row reads as clusters instead of one
// long undifferentiated strip:
//   1. People & Roles      — Staff & Roles, Faculty
//   2. Approvals & Requests — Approvals
//   3. Academics            — Manage Batches, Classes & Students, Question Bank
//   4. Campus Services      — Service Providers, Blood Bank
//   5. Outreach & Insight   — Communication, Analytics
// `trust` is `hidden: true` (filtered out of both grid and chip row
// before render — see AdminDashboard.jsx's `.filter((cat) => !cat.hidden)`
// call sites) so its position here doesn't affect anything visible; left
// in place rather than moved, to keep this diff to the visible clusters.
export const FOUNDER_CATEGORIES = [
  // --- 1. People & Roles ---
  {
    key: 'staff',
    label: 'Staff & Roles',
    icon: 'Users',
    subtitle: 'Assign and manage every staff role, by category',
    subcategories: [
      { key: 'assign', label: 'Assign a Role' },
      { key: 'holders', label: 'Current Holders', getCount: (ctx) => ctx.staffHolders },
    ],
  },
  {
    key: 'faculty',
    label: 'Faculty',
    icon: 'GraduationCap',
    subtitle: 'Directory, verification, and class assignments',
    // BUGFIX (Faculty chip showing no badge despite pending signups): this
    // category only had getCount on its `pending` subcategory, never on
    // the top-level entry itself — so CategorySubNav's top chip row (and
    // the grid card) always resolved a badge count of 0 even when the
    // Signup Requests sub-tab correctly showed a number. Every other
    // approval-bearing category (Approvals, Question Bank, Blood Bank,
    // Trust & Safety) has a matching top-level getCount; this brings
    // Faculty in line with that pattern.
    getCount: (ctx) => ctx.facultyPending,
    subcategories: [
      { key: 'directory', label: 'Directory', getCount: (ctx) => ctx.facultyCount },
      { key: 'pending', label: 'Signup Requests', getCount: (ctx) => ctx.facultyPending },
      { key: 'assignments', label: 'Class Assignments' },
    ],
  },
  // --- 2. Approvals & Requests ---
  {
    key: 'approvals',
    label: 'Approvals',
    icon: 'CheckCircle2',
    subtitle: 'Campus Lead applications, CR requests, CR leave requests',
    getCount: (ctx) => ctx.clApplications + ctx.crRequests + ctx.leaveRequests + ctx.manualVerifyRequests + ctx.qbUploadRequests + ctx.accountDeleteRequests + ctx.pendingPublications,
    subcategories: [
      { key: 'cl-apps', label: 'CL Applications', getCount: (ctx) => ctx.clApplications },
      { key: 'cr-req', label: 'CR Requests', getCount: (ctx) => ctx.crRequests },
      { key: 'cr-leave', label: 'CR Leave Requests', getCount: (ctx) => ctx.leaveRequests },
      { key: 'manual-verify', label: 'Student Manual Verification', getCount: (ctx) => ctx.manualVerifyRequests },
      { key: 'qb-uploads', label: 'Question Bank (Upload / Review)', getCount: (ctx) => ctx.qbUploadRequests },
      { key: 'account-deletion', label: 'Account Deletion', getCount: (ctx) => ctx.accountDeleteRequests },
      // Community-submitted publications awaiting Founder review — see
      // PendingPublicationsPanel.jsx / pendingPublicationsSync.js.
      { key: 'publications', label: 'Publications (Community Submissions)', getCount: (ctx) => ctx.pendingPublications },
    ],
  },
  // --- 3. Academics ---
  {
    key: 'batches',
    label: 'Manage Batches',
    icon: 'Users',
    subtitle: 'Active batch list & colors',
    // No subcategories — a single list+form (BatchesContent).
  },
  {
    key: 'classes',
    label: 'Classes & Students',
    icon: 'GraduationCap',
    subtitle: (ctx) => `${ctx.classCount ?? '…'} classes — browse by Department → Batch`,
    drilldown: true,
  },
  {
    key: 'question-bank',
    label: 'Question Bank',
    icon: 'BookOpen',
    subtitle: 'Founder upload, Campus Lead review queue, delete requests',
    getCount: (ctx) => ctx.qbUploadRequests,
    subcategories: [
      { key: 'upload', label: 'Upload (any dept)' },
      { key: 'review', label: 'Review Queue', getCount: (ctx) => ctx.qbUploadRequests },
      { key: 'delete-requests', label: 'Delete Requests' },
    ],
  },
  // --- 4. Campus Services ---
  {
    key: 'providers',
    label: 'Service Providers',
    icon: 'Store',
    subtitle: 'Verify, browse, and manage every service provider account',
    // Moved here from Approvals → 'provider-verify' (was a buried
    // sub-tab with no day-to-day management view). getCount only
    // reflects pending verification requests — the 'directory' sub-tab
    // itself isn't an approval queue, so it doesn't need to contribute
    // to this badge.
    getCount: (ctx) => ctx.providerVerifyRequests,
    subcategories: [
      { key: 'verify', label: 'Verification Requests', getCount: (ctx) => ctx.providerVerifyRequests },
      { key: 'directory', label: 'All Providers' },
      // Open Errand Request Feed migration — centralized accept log
      // (person's explicit ask: "ke kobe ki accept korse shob ekjaygay").
      // Lives here rather than as its own top-level category since it's
      // still conceptually part of Campus Services / the old "Pick and
      // Drop" cluster, just no longer shop-based.
      { key: 'errands', label: 'Errand Requests' },
    ],
  },
  {
    key: 'blood',
    label: 'Blood Bank',
    icon: 'Droplet',
    subtitle: (ctx) => `${ctx.bloodDonorCount ?? '…'} students on file — search by blood group`,
    getCount: (ctx) => ctx.bloodDonorCount,
    // No subcategories — a single search screen (BloodBankView).
  },
  // --- 5. Outreach & Insight ---
  {
    key: 'comms',
    label: 'Communication',
    icon: 'Megaphone',
    subtitle: 'Send a notice to everyone, one batch, or one class',
    // No subcategories — a single form. SubcategoryTabs renders nothing
    // for a category with no `subcategories`/`drilldown`, which is fine.
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: 'BarChart2',
    subtitle: 'DAU/WAU/MAU, retention, and feature adoption across all departments',
    // No subcategories — a single AnalyticsDashboard (dept=null, sees
    // every department). Founder-only, per the Data & Privacy Policy note
    // at the top of firestore.rules — no badge count, this isn't an
    // approval queue.
  },
  // --- Hidden (not part of any visible cluster — see file-header note) ---
  {
    key: 'trust',
    label: 'Trust & Safety',
    icon: 'Flag',
    // Feature off for now (kept working, just hidden from the founder
    // grid) — set hidden: false to bring the button back. Nothing here
    // was deleted; TrustSafetyView and its data still work if linked to
    // directly.
    hidden: true,
    subtitle: 'Email flags and roll unlock requests',
    getCount: (ctx) => ctx.emailFlags + ctx.rollRequests,
    subcategories: [
      { key: 'flags', label: 'Email Flags', getCount: (ctx) => ctx.emailFlags },
      { key: 'roll', label: 'Roll Unlock Requests', getCount: (ctx) => ctx.rollRequests },
    ],
  },
];

export function getFounderCategory(key) {
  return FOUNDER_CATEGORIES.find((c) => c.key === key) || null;
}

export function resolveCount(entry, ctx) {
  if (!entry?.getCount) return 0;
  try {
    return entry.getCount(ctx) || 0;
  } catch {
    return 0;
  }
}

export function resolveSubtitle(entry, ctx) {
  if (typeof entry?.subtitle === 'function') return entry.subtitle(ctx);
  return entry?.subtitle || '';
}
