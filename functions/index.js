/**
 * KUETx — Push-on-new-notice Cloud Function (Phase E, server side).
 *
 * NOT auto-deployed by this delivery — this is new infrastructure that
 * needs its own `firebase deploy --only functions` from someone with
 * deploy access to the KUETx Firebase project. See README_PUSH_SETUP.md
 * in this same folder for the exact steps.
 *
 * Two triggers, mirroring the two notice sources in noticeUtils.js:
 *   1. onGlobalNoticeCreate — root `notices/{id}` (admin broadcasts)
 *   2. onGroupNoticeCreate  — `groups/{groupId}/notices/{id}` (CR/ACR)
 *
 * Both resolve target users' fcmTokens (saved by src/lib/push.js onto
 * users/{uid}.fcmTokens) and send via admin.messaging().sendEachForMulticast().
 * Invalid/expired tokens returned in the response are pruned from the
 * user doc so the array doesn't grow stale forever.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

async function sendToTokens(tokens, { title, body, link, noticeId }) {
  if (!tokens.length) return;
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { link: link || '/notice', noticeId: noticeId || '' },
    webpush: {
      fcmOptions: { link: link || '/notice' },
    },
  });

  // Prune tokens Firebase reports as invalid/unregistered.
  const deadTokens = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
        deadTokens.push(tokens[i]);
      }
    }
  });
  if (deadTokens.length) {
    const usersSnap = await db.collection('users').where('fcmTokens', 'array-contains-any', deadTokens.slice(0, 10)).get();
    await Promise.all(
      usersSnap.docs.map((d) => d.ref.update({ fcmTokens: FieldValue.arrayRemove(...deadTokens) }))
    );
  }
}

async function tokensForAudience(audience) {
  // Mirrors noticeAppliesTo() in src/lib/groupSync.js — kept intentionally
  // simple/duplicated here rather than shared, since this runs in a
  // separate Node runtime (functions) from the client bundle.
  let usersQuery = db.collection('users');
  if (audience?.type === 'batch' && audience.batch) {
    usersQuery = usersQuery.where('profile.batch', '==', audience.batch);
  } else if (audience?.type === 'group' && audience.groupId) {
    usersQuery = usersQuery.where('profile.groupId', '==', audience.groupId);
  }
  // type 'all' → no extra filter, everyone with a token gets it.
  const snap = await usersQuery.get();
  const tokens = [];
  snap.forEach((doc) => {
    const arr = doc.data()?.fcmTokens;
    if (Array.isArray(arr)) tokens.push(...arr);
  });
  return [...new Set(tokens)];
}

exports.onGlobalNoticeCreate = onDocumentCreated('notices/{noticeId}', async (event) => {
  const notice = event.data?.data();
  if (!notice) return;
  const tokens = await tokensForAudience(notice.audience);
  await sendToTokens(tokens, {
    title: notice.title,
    body: notice.body,
    link: '/notice',
    noticeId: event.params.noticeId,
  });
});

exports.onGroupNoticeCreate = onDocumentCreated('groups/{groupId}/notices/{noticeId}', async (event) => {
  const notice = event.data?.data();
  if (!notice) return;
  const tokens = await tokensForAudience({ type: 'group', groupId: event.params.groupId });
  await sendToTokens(tokens, {
    title: notice.title,
    body: notice.body,
    link: '/notice',
    noticeId: event.params.noticeId,
  });
});

/**
 * Auto-approval policy — student join notification (non-blocking).
 *
 * Students no longer need CR approval to join their department/batch
 * group (see groups/{groupId}/members create rule in firestore.rules —
 * that was already possible, this just removes the client-side UI gate
 * that used to sit in front of it). CR/ACR still get told, via a small
 * system-authored notice in the SAME group notices feed they already
 * read (subscribeGroupNotices in groupSync.js) — this is server-side
 * (Admin SDK), not a client write, so it can't be spoofed and doesn't
 * need its own new firestore.rules allowance.
 */
exports.onMemberJoin = onDocumentCreated('groups/{groupId}/members/{memberUid}', async (event) => {
  const member = event.data?.data();
  if (!member || member.role !== 'member') return; // only plain joins, not CR/ACR appointments
  const { groupId } = event.params;
  const name = member.name || member.roll || 'A student';
  await db.collection('groups').doc(groupId).collection('notices').add({
    title: 'New student joined',
    body: `${name} joined this class.`,
    postedBy: { name: 'KUETx', role: 'system' },
    system: true,
    createdAt: FieldValue.serverTimestamp(),
  });
});

/**
 * Auto-approval policy — faculty signup notification (non-blocking).
 *
 * Faculty accounts are auto-active immediately (see faculty/{uid} create
 * rule in firestore.rules) — no email verification needed to start
 * teaching. This trigger auto-creates the manualVerifyRequests doc the
 * Founder's existing Approvals tab already knows how to show/approve
 * (see manualVerifyRequests.js — this reuses that exact pipeline rather
 * than inventing a new one), so the Founder always gets pinged for Blue
 * Tick review without the faculty member having to ask for it.
 */
exports.onFacultySignup = onDocumentCreated('faculty/{uid}', async (event) => {
  const faculty = event.data?.data();
  const { uid } = event.params;
  if (!faculty) return;
  await db.collection('manualVerifyRequests').add({
    role: 'faculty',
    name: faculty.name || '',
    email: faculty.officialEmail || '',
    roll: null,
    dept: faculty.dept || null,
    uid,
    status: 'pending',
    requestedAt: FieldValue.serverTimestamp(),
  });
});

/**
 * OTP-code email verification (shared by student + faculty flows).
 *
 * "OTP main, magic link backup" — this doesn't replace the existing
 * sendKuetVerificationLink / sendFacultyVerificationLink magic-link path
 * (kuetEmailVerify.js / facultyEmailVerify.js); both stay available side
 * by side. This adds the OTP alternative on top, sharing the same target
 * collections (verifiedRolls/{roll}, verifiedFacultyEmails/{email}) as the
 * final proof-of-ownership record, so anything downstream that already
 * checks those collections (faculty/{uid}.verifiedAt gate, group auto-join,
 * etc.) works identically no matter which method the person used.
 *
 * Design:
 *   1. requestOtp({ email, role }) — generates a random 6-digit code,
 *      stores it hashed-by-nothing (plain, since it's single-use and
 *      short-lived — see rationale below) in Firestore `otpCodes/{email}`,
 *      and writes a doc into `mail` for the Trigger Email extension to
 *      pick up and actually send. Rate-limited per email (60s cooldown)
 *      to stop resend-spam abuse.
 *   2. verifyOtp({ email, code, role }) — reads the stored code, checks
 *      match + expiry (10 min) + attempt count (max 5 tries), and on
 *      success writes the SAME durable verifiedRolls/{roll} or
 *      verifiedFacultyEmails/{email} doc the magic-link path writes,
 *      then deletes the now-used otpCodes/{email} doc.
 *
 * Why the code is stored in plaintext rather than hashed: it's a 6-digit
 * space (1 in 900,000), single-use, expires in 10 minutes, and is only
 * ever read server-side (Admin SDK — Firestore rules deny all client
 * access to otpCodes/* entirely, see firestore.rules). Hashing a 6-digit
 * OTP adds no real defense here — attempt-count + expiry are what
 * actually matter, and both are enforced server-side below regardless.
 *
 * These are the ONLY writers of otpCodes/*, verifiedRolls/*, and
 * verifiedFacultyEmails/* for the OTP path — the client never touches
 * those collections directly for OTP; it only calls these two functions.
 */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends
const OTP_MAX_ATTEMPTS = 5;

const KUET_STUDENT_EMAIL_RE = /^[a-z]+(\d{7})@stud\.kuet\.ac\.bd$/i;
const KUET_FACULTY_EMAIL_RE = /^[^\s@]+@([a-z0-9-]+\.)*kuet\.ac\.bd$/i;
const KUET_STUDENT_SUBDOMAIN_RE = /@stud\.kuet\.ac\.bd$/i;
// Mirrors facultyEmailVerify.js's TEMP testing bypass — kept in sync
// deliberately; remove both together before public launch.
const FACULTY_TESTING_BYPASS_EMAILS = ['guluvai479@gmail.com'];

function isValidEmailForRole(email, role) {
  const trimmed = String(email || '').trim();
  if (role === 'student') return KUET_STUDENT_EMAIL_RE.test(trimmed);
  if (role === 'teacher') {
    if (FACULTY_TESTING_BYPASS_EMAILS.includes(trimmed.toLowerCase())) return true;
    if (KUET_STUDENT_SUBDOMAIN_RE.test(trimmed)) return false;
    return KUET_FACULTY_EMAIL_RE.test(trimmed);
  }
  return false;
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 100000-999999
}

function otpDocId(email) {
  // Firestore doc IDs can't contain '/', but emails can't either, so the
  // raw lowercased email is a safe, readable doc ID here.
  return String(email || '').trim().toLowerCase();
}

exports.requestOtp = onCall(async (request) => {
  const email = String(request.data?.email || '').trim();
  const role = String(request.data?.role || '').trim(); // 'student' | 'teacher'

  if (!isValidEmailForRole(email, role)) {
    throw new HttpsError(
      'invalid-argument',
      role === 'teacher'
        ? "This doesn't look like a KUET faculty email (expected something@<dept>.kuet.ac.bd)."
        : 'এটা একটা KUET student email মনে হচ্ছে না (name+roll@stud.kuet.ac.bd আকারে হওয়ার কথা)।'
    );
  }

  const docRef = db.collection('otpCodes').doc(otpDocId(email));
  const existing = await docRef.get();
  if (existing.exists) {
    const data = existing.data();
    const lastSentAt = data.lastSentAt?.toMillis?.() ?? 0;
    if (Date.now() - lastSentAt < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000);
      throw new HttpsError('resource-exhausted', `Please wait ${waitSec}s before requesting another code.`);
    }
  }

  const code = generateOtpCode();
  await docRef.set({
    email,
    role,
    code,
    attempts: 0,
    createdAt: FieldValue.serverTimestamp(),
    lastSentAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  // Trigger Email extension convention: any doc written into `mail`
  // gets picked up and sent automatically — no SMTP/API-key code needed
  // in this function at all, as long as the extension is installed
  // (Firebase Console → Extensions → "Trigger Email from Firestore").
  await db.collection('mail').add({
    to: [email],
    message: {
      subject: `KUETx verification code: ${code}`,
      text: `Your KUETx verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `<p>Your KUETx verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
    },
  });

  return { sent: true };
});

exports.verifyOtp = onCall(async (request) => {
  const email = String(request.data?.email || '').trim();
  const code = String(request.data?.code || '').trim();
  const role = String(request.data?.role || '').trim();

  if (!email || !code) {
    throw new HttpsError('invalid-argument', 'Email and code are both required.');
  }

  const docRef = db.collection('otpCodes').doc(otpDocId(email));
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'No pending code for this email — request a new one.');
  }

  const data = snap.data();
  const expiresAtMs = data.expiresAt?.toMillis?.() ?? new Date(data.expiresAt).getTime();
  if (Date.now() > expiresAtMs) {
    await docRef.delete();
    throw new HttpsError('deadline-exceeded', 'This code has expired. Please request a new one.');
  }

  if ((data.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    await docRef.delete();
    throw new HttpsError('resource-exhausted', 'Too many incorrect attempts. Please request a new code.');
  }

  if (data.code !== code) {
    await docRef.update({ attempts: FieldValue.increment(1) });
    throw new HttpsError('invalid-argument', 'Incorrect code. Please try again.');
  }

  // Match confirmed — write the SAME durable proof-of-ownership record the
  // magic-link path writes, keyed identically, so every downstream reader
  // (group auto-join, faculty/{uid}.verifiedAt gate) works unchanged.
  if (role === 'student') {
    const match = KUET_STUDENT_EMAIL_RE.exec(email);
    const roll = match?.[1];
    if (roll) {
      await db.collection('verifiedRolls').doc(roll).set({ verifiedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  } else if (role === 'teacher') {
    await db.collection('verifiedFacultyEmails').doc(email).set({ verifiedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  await docRef.delete();
  return { verified: true, email, role };
});
