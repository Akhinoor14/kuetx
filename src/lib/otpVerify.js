// otpVerify.js
//
// Shared frontend wrapper around the requestOtp / verifyOtp Cloud
// Functions (functions/index.js) — the "code main, link backup" method.
// Used by BOTH student (KuetEmailVerifyWidget/Box) and faculty
// (FacultyVerifyHoldingScreen/FacultyVerifyEmailConfirmModal) verify UIs;
// role is passed through so one backend serves both without duplicating
// the email-format checks or the Firestore write target.
//
// This does NOT replace the existing magic-link flow (kuetEmailVerify.js /
// facultyEmailVerify.js) — both stay fully functional. The OTP path here
// writes to the exact same durable collections (verifiedRolls/{roll},
// verifiedFacultyEmails/{email}) so anything downstream that checks those
// (group auto-join, faculty/{uid}.verifiedAt gate) works identically
// regardless of which method the person actually used.

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const requestOtpFn = httpsCallable(functions, 'requestOtp');
const verifyOtpFn = httpsCallable(functions, 'verifyOtp');

/**
 * Step 1: ask the backend to generate a 6-digit code and email it.
 * role: 'student' | 'teacher' — same values used elsewhere (accountRole.js).
 * Throws with a user-facing .message on failure (invalid email format,
 * rate-limited resend, etc.) — the Cloud Function's HttpsError message is
 * already written to be shown directly.
 */
export async function requestOtpCode(email, role) {
  const trimmed = String(email || '').trim();
  try {
    await requestOtpFn({ email: trimmed, role });
    return { sent: true, email: trimmed };
  } catch (err) {
    throw new Error(err?.message || 'Could not send the verification code. Please try again.');
  }
}

/**
 * Step 2: submit the 6-digit code the person received. On success, the
 * matching verifiedRolls/{roll} or verifiedFacultyEmails/{email} doc has
 * already been written server-side (see functions/index.js verifyOtp) —
 * the caller just needs to re-check/refresh whatever local state depends
 * on that (e.g. re-run isFacultyProfileComplete/verifiedAt sync, or
 * rebuild the onboarding queue).
 */
export async function verifyOtpCode(email, code, role) {
  const trimmed = String(email || '').trim();
  const trimmedCode = String(code || '').trim();
  try {
    const result = await verifyOtpFn({ email: trimmed, code: trimmedCode, role });
    return result.data; // { verified: true, email, role }
  } catch (err) {
    throw new Error(err?.message || 'Could not verify the code. Please try again.');
  }
}
