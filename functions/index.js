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
 *
 * NOTE ON deleteMyAccount BELOW: this whole file requires the Blaze
 * billing plan to deploy at all — this project has decided to stay on
 * Spark (free) permanently, so NONE of these functions are currently
 * live, including deleteMyAccount. Every export below except
 * deleteMyAccount is otherwise-working infrastructure just waiting on a
 * future Blaze decision that may never come. deleteMyAccount
 * specifically is flagged inline as dead/reference code — the real,
 * permanent account-deletion path is client-side (see
 * src/lib/accountDeletion.js and docs/ACCOUNT_DELETION_PLAN.md), not
 * this function.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { getAuth } = require('firebase-admin/auth');

initializeApp();
const db = getFirestore();

// Telegram bot token — plain env variable (NOT Secret Manager, which
// requires the Blaze plan). Firebase Functions v2 auto-loads a
// functions/.env file at deploy/runtime, so this just reads it like any
// other Node env var. Put TELEGRAM_BOT_TOKEN=<token from @BotFather> in
// functions/.env — that file must NEVER be committed (see functions/
// .gitignore, added alongside this).
function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

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
 * Telegram push — CR/ACR-only, opt-in, one-group-per-class (Phase F).
 *
 * Design (kept deliberately simple — one bot, no per-class bot tokens):
 *   1. CR clicks "Connect Telegram" on /class-setup (client calls
 *      startTelegramLink below), which mints a short random code tied to
 *      their own groupId and stores it in telegramLinkCodes/{code} with a
 *      15-minute expiry — NOT the raw groupId, so a stranger can't just
 *      guess another class's groupId (e.g. "2k23_cse") and hijack their
 *      notice feed into an unrelated Telegram chat.
 *   2. CR adds the bot to their own class Telegram group and sends
 *      "/register <code>" there.
 *   3. Telegram calls telegramWebhook (this bot's one single webhook URL,
 *      set once via setWebhook — see README_PUSH_SETUP.md), which looks
 *      up the code, resolves it back to a groupId, and saves that chat's
 *      id onto groups/{groupId}/meta/classSetup.telegramChatId — the same
 *      one doc every other CR-set field already lives on.
 *   4. Every new groups/{groupId}/notices/{id} doc (same trigger source as
 *      onGroupNoticeCreate above) gets mirrored to that one chat via
 *      sendMessage, and to NO other chat. A class that never connects
 *      Telegram just never gets a telegramChatId — this trigger silently
 *      no-ops for them, same fail-open-to-nothing pattern as sendToTokens
 *      with an empty tokens array above.
 *
 * WhatsApp is deliberately NOT part of this — WhatsApp's official Cloud
 * API doesn't support posting into groups/Channels at all; the only way
 * to do it is unofficial Web-protocol automation that risks the number
 * being banned, which isn't something to build into production
 * infrastructure. Telegram-only, by design, not by omission.
 */
const TELEGRAM_LINK_CODE_TTL_MS = 15 * 60 * 1000;

function generateLinkCode() {
  // Short, easy to type by hand into a Telegram chat: e.g. "KX-7F3A2".
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `KX-${s}`;
}

async function telegramApi(method, token, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

/**
 * Callable from the client (ClassSetup.jsx "Connect Telegram" button).
 * CR/ACR-only in effect because it requires an authenticated request AND
 * the caller's own profile.groupId to match the groupId they're linking —
 * a student can only ever mint a code for their own class, never anyone
 * else's.
 */
exports.startTelegramLink = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Please sign in first.');
  const groupId = String(request.data?.groupId || '').trim();
  if (!groupId) throw new HttpsError('invalid-argument', 'Missing groupId.');

  const memberSnap = await db.collection('groups').doc(groupId).collection('members').doc(uid).get();
  const role = memberSnap.exists ? memberSnap.data()?.role : null;
  if (role !== 'cr' && role !== 'acr') {
    throw new HttpsError('permission-denied', 'Only your class CR/ACR can connect Telegram.');
  }

  const code = generateLinkCode();
  await db.collection('telegramLinkCodes').doc(code).set({
    groupId,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + TELEGRAM_LINK_CODE_TTL_MS),
    used: false,
  });
  return { code, expiresInMinutes: TELEGRAM_LINK_CODE_TTL_MS / 60000 };
});

/**
 * Telegram's single webhook target for this bot. Set once (per
 * README_PUSH_SETUP.md) via:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<this function's URL>"
 * Handles exactly one command: "/register <code>" sent from inside the
 * class's Telegram group/channel after the bot has been added as admin.
 */
exports.telegramWebhook = onRequest(async (req, res) => {
  const token = getTelegramBotToken();
  const update = req.body || {};
  const message = update.message || update.channel_post;
  const text = String(message?.text || '').trim();
  const chatId = message?.chat?.id;

  if (!text.startsWith('/register') || !chatId) {
    res.status(200).send('ok'); // ignore anything else — always 200 so Telegram doesn't retry
    return;
  }

  const code = text.split(/\s+/)[1]?.toUpperCase();
  if (!code) {
    await telegramApi('sendMessage', token, { chat_id: chatId, text: 'Usage: /register <code> — get the code from your Class Setup page in KUETx.' });
    res.status(200).send('ok');
    return;
  }

  const codeRef = db.collection('telegramLinkCodes').doc(code);
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists) {
    await telegramApi('sendMessage', token, { chat_id: chatId, text: 'That code isn\'t valid or has already been used. Generate a new one from Class Setup.' });
    res.status(200).send('ok');
    return;
  }

  const data = codeSnap.data();
  const expiresAtMs = data.expiresAt?.toMillis?.() ?? new Date(data.expiresAt).getTime();
  if (data.used || Date.now() > expiresAtMs) {
    await telegramApi('sendMessage', token, { chat_id: chatId, text: 'That code has expired. Generate a new one from Class Setup and try again.' });
    res.status(200).send('ok');
    return;
  }

  await db.collection('groups').doc(data.groupId).collection('meta').doc('classSetup').set({
    telegramChatId: String(chatId),
    telegramLinkedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await codeRef.update({ used: true });

  await telegramApi('sendMessage', token, {
    chat_id: chatId,
    text: '✅ Connected! This group will now receive KUETx notices automatically.',
  });
  res.status(200).send('ok');
});

exports.onGroupNoticeCreateTelegram = onDocumentCreated('groups/{groupId}/notices/{noticeId}', async (event) => {
  const notice = event.data?.data();
  if (!notice) return;
  const { groupId } = event.params;
  const setupSnap = await db.collection('groups').doc(groupId).collection('meta').doc('classSetup').get();
  const chatId = setupSnap.exists ? setupSnap.data()?.telegramChatId : null;
  if (!chatId) return; // this class never connected Telegram — no-op, not an error

  const token = getTelegramBotToken();
  const text = `📢 *${escapeMarkdown(notice.title || 'Notice')}*\n${escapeMarkdown(notice.body || '')}`;
  await telegramApi('sendMessage', token, { chat_id: chatId, text, parse_mode: 'Markdown' });
});

function escapeMarkdown(s) {
  return String(s || '').replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// TODO(Blaze): Once the Firebase project is on the Blaze (pay-as-you-go)
// plan — needed because outbound SMS gateway calls require the outbound
// network access that the free Spark plan's Cloud Functions don't have —
// add an `onGroupNoticeCreateSms` trigger here (or fan out from inside
// onGroupNoticeCreateTelegram above; either is fine, this doesn't need to
// be a second exports.* function) that:
//   1. Reads `notice.channelHints` off the created doc (see
//      postGroupNotice in src/lib/groupSync.js) and no-ops unless it
//      includes 'sms' — most notices (regular CR announcements, join/leave
//      system notices, etc.) are Telegram-only and should NOT trigger SMS
//      just because this new trigger exists.
//   2. Reads phone numbers from a new `smsOptInNumbers` field on
//      groups/{groupId}/meta/classSetup (same doc as telegramChatId above)
//      — this field does not exist yet, no need to create it until this
//      TODO is actually picked up.
//   3. Calls an SMS gateway (Twilio, or a local Bangladeshi SMS gateway —
//      whichever ends up cheaper/more reliable is fine, no decision made
//      yet) once per opted-in number.
// Full context: docs/NOTIFICATION_ARCHITECTURE.md and
// CLASS_TOGGLE_NOTIFICATION_PROMPT.md section 4.
// Until this exists, notices with channelHints including 'sms' are simply
// not delivered over SMS — Telegram delivery (above) is unaffected and
// requires no changes when this TODO is eventually done.

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

/**
 * MULTI_CATEGORY_SERVICES_PLAN.md Phase 2 — dormant-shop auto-detection.
 *
 * NOT auto-deployed by this delivery, same as every other function in this
 * file — needs `cd functions && npm install` then
 * `firebase deploy --only functions` from someone with deploy access (see
 * this phase's note in MULTI_CATEGORY_SERVICES_PLAN.md's "তোমার নিজের
 * করণীয়" section, and confirm the project is on the Blaze plan first —
 * onSchedule requires it).
 *
 * Runs once a day. For every services/{serviceId} doc currently
 * status == 'open', flags it dormant if BOTH:
 *   (a) no offering has isAvailable == true (everything sold out/closed), AND
 *   (b) that all-unavailable state has held for >= DORMANT_THRESHOLD_DAYS
 *       (14, per the plan) — tracked via a new `offeringsUpdatedAt`
 *       timestamp field, stamped by setServiceOfferings() every time the
 *       offerings array is written (see serviceSync.js) so this function
 *       never has to guess how long the current state has persisted.
 *
 * Only ever moves status 'open' -> 'dormant' with dormantReason: 'auto'.
 * Never touches a service that's already 'dormant' (manual or auto) or
 * 'closed' — those are owner-driven states this function doesn't second-
 * guess. Runs with admin privileges (the Admin SDK bypasses
 * firestore.rules entirely, unlike the client SDK), so the enum-validity
 * of what this function writes is guaranteed by this function's own code
 * below (a fixed literal 'dormant'/'auto'), not by firestore.rules' own
 * isAdmin() validation branch — that branch exists for Founder-driven
 * client-side admin edits through the app UI, a separate write path from
 * this server-side function.
 */
const DORMANT_THRESHOLD_DAYS = 14;
const DORMANT_THRESHOLD_MS = DORMANT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

exports.detectDormantServices = onSchedule('every 24 hours', async () => {
  const snap = await db.collection('services').where('status', '==', 'open').get();
  if (snap.empty) return;

  const now = Date.now();
  const batch = db.batch();
  let flaggedCount = 0;

  snap.docs.forEach((docSnap) => {
    const service = docSnap.data();
    const offerings = Array.isArray(service.offerings) ? service.offerings : [];
    const anyAvailable = offerings.some((o) => o && o.isAvailable === true);
    if (anyAvailable) return; // has at least one live offering — not dormant

    // No offeringsUpdatedAt yet (service predates this field, or never
    // had its offerings touched) — fall back to createdAt so a genuinely
    // old, never-updated service can still be caught, per the plan's
    // "নতুন কোনো offering যোগ/আপডেট হয়নি" condition.
    const lastTouched = service.offeringsUpdatedAt?.toMillis?.()
      ?? service.createdAt?.toMillis?.()
      ?? null;
    if (lastTouched == null) return; // can't determine staleness — skip, don't guess
    if (now - lastTouched < DORMANT_THRESHOLD_MS) return; // not stale long enough yet

    batch.update(docSnap.ref, {
      status: 'dormant',
      dormantReason: 'auto',
      dormantSince: FieldValue.serverTimestamp(),
    });
    flaggedCount += 1;
  });

  if (flaggedCount > 0) {
    await batch.commit();
  }
});

/**
 * deleteMyAccount — full self-service account wipe (Admin SDK, callable).
 *
 * ⚠️ DEAD CODE — NOT DEPLOYED, NOT CALLABLE, NOT PLANNED TO BE.
 * This project has decided to stay on the Firebase Spark (free) plan
 * permanently (no billing account available). Cloud Functions deploy
 * requires Blaze, so this function has never run and never will unless
 * that decision changes. The actual, permanent account-deletion path is
 * client-side: see src/lib/accountDeletion.js and
 * docs/ACCOUNT_DELETION_PLAN.md. Nothing in the client calls this by
 * name. Left here only as a reference for what a complete, atomic,
 * server-side implementation would look like if this project's Spark
 * decision is ever revisited — do not wire anything up to this without
 * first re-reading the plan doc's "What NOT to do" section.
 *
 * Everything below this notice describes what the function WOULD do if
 * it were ever deployed.
 *
 * Why a Cloud Function and not a client-side delete: Firestore security
 * rules restrict every collection to its owner (or role-gated staff), so
 * the client SDK can never reliably clean up EVERYTHING one account
 * touched — e.g. removing yourself from groups/{groupId}/members/{uid}
 * needs write access scoped by the rules to CR/ACR, not the member being
 * removed. And only the Admin SDK can delete the underlying Firebase Auth
 * user at all — auth.currentUser.delete() client-side exists, but pairing
 * it with a guaranteed-to-run Firestore wipe first needs one atomic
 * server-side operation, not two separate client calls that could partially
 * fail (data wiped but Auth account survives, or vice versa — either leaves
 * the account in a broken half-deleted state).
 *
 * Confirmation is enforced here, not just in the UI, so a compromised or
 * modified client can't call this without the phrase — request.data.confirm
 * must exactly equal the signed-in user's own email.
 *
 * Deletes, for request.auth.uid:
 *   - users/{uid}                          (root profile/role doc)
 *   - users/{uid}/data/*                   (personal store: Notes, Diary, …)
 *   - users/{uid}/meta/*                   (profile picture meta)
 *   - students/{uid}                       (Phase 5 profile doc)
 *   - faculty/{uid}                        (+ faculty/{uid}/private/*)
 *   - providers/{uid}                      (+ providers/{uid}/contact/*)
 *   - staff/{uid}                          (+ staff/{uid}/roles/*)
 *   - activity/{uid}                       (+ activity/{uid}/moduleUsage/*)
 *   - bloodDonors/{uid}
 *   - bookingAlerts/{uid}/items/*
 *   - emailFlags/{uid}                     (doc id IS the uid — see emailFlags.js)
 *   - groups/{groupId}/members/{uid}       (own membership, every group joined)
 *   - the Firebase Auth user itself
 *
 * Left alone on purpose (not this account's private data, or needed for
 * other users' records to stay consistent):
 *   - staffRoleHistory, manualVerifyRequests, deleteRequests, notices,
 *     services, rollUnlockRequests — these are audit trails / other
 *     people's pending requests that reference this uid but aren't owned
 *     by it; deleting them would corrupt someone else's history or an
 *     in-flight review someone else is waiting on.
 *   - rollOwners/{roll} — the roll-number lock. Left in place deliberately:
 *     freeing it would let a different account immediately claim this
 *     person's KUET roll number, which is a worse outcome than a stale
 *     lock. Founder can release it manually via the existing rollOwnership
 *     admin flow if genuinely needed.
 */
exports.deleteMyAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const authUser = await getAuth().getUser(uid).catch(() => null);
  const expectedConfirm = (authUser?.email || uid).trim().toLowerCase();
  const providedConfirm = String(request.data?.confirm || '').trim().toLowerCase();

  if (!providedConfirm || providedConfirm !== expectedConfirm) {
    throw new HttpsError(
      'failed-precondition',
      'Confirmation text does not match. Nothing was deleted.'
    );
  }

  // Firestore has no recursive-delete for arbitrary subcollections in a
  // batch — walk each known subcollection explicitly, then the parent doc.
  const deleteDocAndSubcollections = async (docRef) => {
    const subcols = await docRef.listCollections();
    for (const sub of subcols) {
      const snap = await sub.get();
      if (snap.empty) continue;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await docRef.delete();
  };

  const rootDocsToWipe = [
    db.collection('users').doc(uid),
    db.collection('students').doc(uid),
    db.collection('faculty').doc(uid),
    db.collection('providers').doc(uid),
    db.collection('staff').doc(uid),
    db.collection('activity').doc(uid),
    db.collection('bookingAlerts').doc(uid),
    db.collection('bloodDonors').doc(uid),
    db.collection('emailFlags').doc(uid),
  ];

  // Resolve this account's group membership BEFORE wiping students/{uid}
  // (that doc holds the groupId pointer we need). Primary source: the
  // profile doc's own groupId field — O(1), no scanning. Fallback: a
  // collectionGroup('members') scan filtered to this uid, in case the
  // pointer is stale/missing but a membership doc still exists somewhere
  // (e.g. group was switched without the old membership being cleaned up
  // client-side). The fallback only runs if the fast path finds nothing.
  const studentSnap = await db.collection('students').doc(uid).get();
  const knownGroupId = studentSnap.exists ? studentSnap.data()?.groupId : null;

  let groupMemberRefs = [];
  if (knownGroupId) {
    groupMemberRefs = [db.collection('groups').doc(knownGroupId).collection('members').doc(uid)];
  } else {
    const memberDocs = await db.collectionGroup('members').get();
    groupMemberRefs = memberDocs.docs.filter((d) => d.id === uid).map((d) => d.ref);
  }

  for (const ref of rootDocsToWipe) {
    await deleteDocAndSubcollections(ref);
  }

  if (groupMemberRefs.length) {
    // Batches cap at 500 writes; membership counts will never approach
    // that for one account, but chunk defensively anyway.
    for (let i = 0; i < groupMemberRefs.length; i += 400) {
      const chunk = groupMemberRefs.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }

  // Auth user last — if anything above throws, the person still has a
  // working (if partially wiped) account and can retry, rather than an
  // Auth account that can no longer sign in but whose data is still live.
  await getAuth().deleteUser(uid);

  return { deleted: true };
});
