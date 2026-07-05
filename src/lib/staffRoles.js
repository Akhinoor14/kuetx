// staffRoles.js
//
// The official KUETx team hierarchy, as defined in the Manifesto +
// Organizational Structure handbook (v1.0, July 2026). CR is deliberately
// NOT in this catalog — it's a per-class student feature (see groupSync.js),
// not an official KUETx post, even though official post-holders can also
// hold CR in their own class.

export const ROLES = {
  HEAD_OF_OPS: 'head_of_ops',
  FRONTEND_ENG: 'frontend_eng',
  BACKEND_ENG: 'backend_eng',
  DATA_SYSTEMS_LEAD: 'data_systems_lead',
  HEAD_OF_GROWTH: 'head_of_growth',
  QA_ENGINEER: 'qa_engineer',
  DESIGN_LEAD: 'design_lead',
  CONTENT_LEAD: 'content_lead',
  LEGAL_PARTNERSHIPS: 'legal_partnerships',
  FINANCE_LEAD: 'finance_lead',
  SENIOR_CAMPUS_LEAD: 'senior_campus_lead',
  CAMPUS_LEAD: 'campus_lead',
};

export const CORE_TEAM_LEAD_ROLES = [
  ROLES.HEAD_OF_OPS, ROLES.FRONTEND_ENG, ROLES.BACKEND_ENG, ROLES.DATA_SYSTEMS_LEAD,
  ROLES.HEAD_OF_GROWTH, ROLES.QA_ENGINEER, ROLES.DESIGN_LEAD, ROLES.CONTENT_LEAD,
  ROLES.LEGAL_PARTNERSHIPS, ROLES.FINANCE_LEAD,
];

export const ROLE_LABELS = {
  [ROLES.HEAD_OF_OPS]: 'Head of Operations',
  [ROLES.FRONTEND_ENG]: 'Frontend Engineer',
  [ROLES.BACKEND_ENG]: 'Backend Engineer',
  [ROLES.DATA_SYSTEMS_LEAD]: 'Data & Systems Lead',
  [ROLES.HEAD_OF_GROWTH]: 'Head of Growth',
  [ROLES.QA_ENGINEER]: 'QA Engineer',
  [ROLES.DESIGN_LEAD]: 'Design Lead',
  [ROLES.CONTENT_LEAD]: 'Content Lead',
  [ROLES.LEGAL_PARTNERSHIPS]: 'Legal & Partnerships Liaison',
  [ROLES.FINANCE_LEAD]: 'Finance Lead',
  [ROLES.SENIOR_CAMPUS_LEAD]: 'Senior Campus Lead',
  [ROLES.CAMPUS_LEAD]: 'Campus Lead',
};

// Scope shape per role — determines what `scope` object an assignment needs.
// 'global'   -> { type: 'global' }
// 'dept'     -> { type: 'dept', dept }
// 'group'    -> { type: 'group', groupId }
export const ROLE_SCOPE_KIND = {
  [ROLES.HEAD_OF_OPS]: 'global',
  [ROLES.FRONTEND_ENG]: 'global',
  [ROLES.BACKEND_ENG]: 'global',
  [ROLES.DATA_SYSTEMS_LEAD]: 'global',
  [ROLES.HEAD_OF_GROWTH]: 'global',
  [ROLES.QA_ENGINEER]: 'global',
  [ROLES.DESIGN_LEAD]: 'global',
  [ROLES.CONTENT_LEAD]: 'global',
  [ROLES.LEGAL_PARTNERSHIPS]: 'global',
  [ROLES.FINANCE_LEAD]: 'global',
  [ROLES.SENIOR_CAMPUS_LEAD]: 'dept',
  [ROLES.CAMPUS_LEAD]: 'group',
};

// Which roles have an in-app Staff Panel section at all. Frontend/Backend/
// Data-Systems/Design work happens in the codebase, not the in-app panel —
// per the manifesto they're GitHub-based contributors, so they just get a
// "Your roles" credit line, no extra tooling.
export const PANEL_ROLES = [
  ROLES.HEAD_OF_OPS, ROLES.SENIOR_CAMPUS_LEAD, ROLES.CAMPUS_LEAD,
  ROLES.CONTENT_LEAD, ROLES.HEAD_OF_GROWTH, ROLES.FINANCE_LEAD, ROLES.LEGAL_PARTNERSHIPS,
];
