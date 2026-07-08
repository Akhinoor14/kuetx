// scripts/fix_stale_legacyCRClaim.cjs
//
// One-time migration: clears legacyCRClaim on every member doc where
// role !== 'cr' but legacyCRClaim is still true. This is the stuck
// "Claims CR" badge bug — legacyCRClaim was only ever set once at
// joinGroup() time and never cleared by clApproveLeaveCR / clRevokeCR /
// handoffCR before this fix, so anyone who left/lost CR before today
// keeps showing the badge forever. This script is a one-time catch-up
// for docs written before the code fix; going forward the three
// functions above clear the field themselves.
//
// Usage:
//   1. Download a service-account key from Firebase Console
//      (Project settings -> Service accounts -> Generate new private key)
//   2. Save it as ./serviceAccountKey.json in this scripts/ folder
//      (already gitignored — do NOT commit this file)
//   3. node scripts/fix_stale_legacyCRClaim.cjs           # dry run, no writes
//   4. node scripts/fix_stale_legacyCRClaim.cjs --apply   # actually writes

const admin = require('firebase-admin');
const path = require('path');

const APPLY = process.argv.includes('--apply');

admin.initializeApp({
  credential: admin.credential.cert(path.join(__dirname, 'serviceAccountKey.json')),
});
const db = admin.firestore();

async function main() {
  const groupsSnap = await db.collection('groups').get();
  console.log(`Scanning ${groupsSnap.size} groups...`);

  let totalStuck = 0;
  let totalFixed = 0;
  const perGroupReport = [];

  for (const groupDoc of groupsSnap.docs) {
    const groupId = groupDoc.id;
    const membersSnap = await db.collection('groups').doc(groupId).collection('members').get();

    const stuckInThisGroup = [];
    membersSnap.docs.forEach((m) => {
      const data = m.data();
      if (data.role !== 'cr' && data.legacyCRClaim === true) {
        stuckInThisGroup.push({ uid: m.id, name: data.name || '(no name)', roll: data.roll || '(no roll)' });
      }
    });

    if (stuckInThisGroup.length === 0) continue;

    totalStuck += stuckInThisGroup.length;
    perGroupReport.push({ groupId, batch: groupDoc.data().batch, dept: groupDoc.data().dept, members: stuckInThisGroup });

    if (APPLY) {
      const batch = db.batch();
      stuckInThisGroup.forEach(({ uid }) => {
        batch.update(db.collection('groups').doc(groupId).collection('members').doc(uid), { legacyCRClaim: false });
      });
      await batch.commit();
      totalFixed += stuckInThisGroup.length;
    }
  }

  console.log('\n--- Report ---');
  perGroupReport.forEach(({ groupId, batch, dept, members }) => {
    console.log(`\nGroup ${groupId} (${dept || '?'} ${batch || '?'}):`);
    members.forEach((m) => console.log(`  - ${m.name} (${m.roll}) [uid: ${m.uid}]`));
  });

  console.log(`\nTotal stuck "Claims CR" badges found: ${totalStuck}`);
  if (APPLY) {
    console.log(`Fixed (legacyCRClaim -> false): ${totalFixed}`);
  } else {
    console.log('Dry run only — no writes made. Re-run with --apply to fix these.');
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
