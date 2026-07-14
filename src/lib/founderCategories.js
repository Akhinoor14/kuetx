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

export const FOUNDER_CATEGORIES = [
  {
    key: 'approvals',
    label: 'Approvals',
    icon: 'CheckCircle2',
    subtitle: 'Campus Lead applications, CR requests, CR leave requests',
    getCount: (ctx) => ctx.clApplications + ctx.crRequests + ctx.leaveRequests + ctx.manualVerifyRequests + ctx.qbUploadRequests,
    subcategories: [
      { key: 'cl-apps', label: 'CL Applications', getCount: (ctx) => ctx.clApplications },
      { key: 'cr-req', label: 'CR Requests', getCount: (ctx) => ctx.crRequests },
      { key: 'cr-leave', label: 'CR Leave Requests', getCount: (ctx) => ctx.leaveRequests },
      { key: 'manual-verify', label: 'Faculty Blue Tick / Manual Verification', getCount: (ctx) => ctx.manualVerifyRequests },
      { key: 'qb-uploads', label: 'Question Bank (Upload / Review)', getCount: (ctx) => ctx.qbUploadRequests },
    ],
  },
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
    key: 'classes',
    label: 'Classes & Students',
    icon: 'GraduationCap',
    subtitle: (ctx) => `${ctx.classCount ?? '…'} classes — browse by Department → Batch`,
    drilldown: true,
  },
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
  {
    key: 'comms',
    label: 'Communication',
    icon: 'Megaphone',
    subtitle: 'Send a notice to everyone, one batch, or one class',
    // No subcategories — a single form. SubcategoryTabs renders nothing
    // for a category with no `subcategories`/`drilldown`, which is fine.
  },
  {
    key: 'faculty',
    label: 'Faculty',
    icon: 'GraduationCap',
    subtitle: 'Directory, verification, and class assignments',
    // §7 of the merged Faculty Module prompt. ctx.facultyCount/
    // ctx.facultyPending are NOT yet wired into AdminDashboard.jsx's own
    // buildCountCtx() as of this session — that's the one remaining edit
    // needed before these badges show real numbers instead of silently
    // resolving to 0 via resolveCount()'s try/catch fallback (safe, just
    // not yet meaningful). Flagged in PROGRESS.md rather than guessed at,
    // since buildCountCtx()'s exact shape wasn't re-read this session.
    subcategories: [
      { key: 'directory', label: 'Directory', getCount: (ctx) => ctx.facultyCount },
      { key: 'pending', label: 'Signup Requests', getCount: (ctx) => ctx.facultyPending },
      { key: 'assignments', label: 'Class Assignments' },
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
