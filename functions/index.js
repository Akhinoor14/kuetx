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
