// Shared cross-cutting constants for the provider shell.
//
// FOUNDER_PHONE: the single Founder contact number shown to providers in
// more than one place (ProviderVerificationPending.jsx's pending/rejected
// gate, and About.jsx's provider branch). Lifted here so both files import
// the same literal instead of maintaining two copies that could drift.
export const FOUNDER_PHONE = '01724812042';
