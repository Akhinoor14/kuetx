/**
 * ONE-OFF MIGRATION — Phase 2 CR/ACR mobile split backfill
 *
 * Before Phase 2 (CR_TEACHER_LINKING_NOTES.md item 5), a CR/ACR's mobile
 * number lived directly on groups/{groupId}/members/{uid} as a `mobile`
 * field. Phase 2 moved it to a separate, tighter-permission sub-doc:
 * groups/{groupId}/members/{uid}/private/mobile ({ value: "..." }).
 *
 * That move was never backfilled — anyone who set their number BEFORE
 * the split still has it sitting on the old parent-doc field, and an
 * empty/missing new sub-doc, which is why CRMobileNumberBanner.jsx keeps
 * nagging them even though they already gave a number once.
 *
 * This script is READ-MOSTLY and SAFE TO RE-RUN:
 *   - Only touches members with role == 'cr' or role == 'acr'.
 *   - Only writes private/mobile if it does NOT already exist (never
 *     overwrites a value someone already re-entered post-split).
 *   - Only writes if the old parent-doc `mobile` field is non-empty.
 *   - Does NOT delete the old `mobile` field from the parent doc (kept
 *     as a paper trail; harmless since code no longer reads it there).
 *   - Runs with --dry-run first by default-safe usage below.
 *
 * USAGE:
 *   1. Firebase Console → Project Settings → Service Accounts →
 *      "Generate new private key" → save as scripts/serviceAccountKey.json
 *      (this file is gitignored — NEVER commit it, and delete it after use)
 *   2. cd scripts && npm install firebase-admin   (if not already present)
 *   3. Dry run first (no writes, just reports what WOULD change):
 *        node migrateCRMobile.js --dry-run
 *   4. Real run:
 *        node migrateCRMobile.js
 *   5. Delete scripts/serviceAccountKey.json when done.
 */

const admin = require('firebase-admin');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrate() {
  console.log(`\n=== CR/ACR mobile backfill migration ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE)'} ===\n`);

  const groupsSnap = await db.collection('groups').get();
  console.log(`Found ${groupsSnap.size} groups.`);

  let totalCRACR = 0;
  let alreadyHadSubDoc = 0;
  let noOldMobile = 0;
  let migrated = 0;
  let errors = 0;

  for (const groupDoc of groupsSnap.docs) {
    const groupId = groupDoc.id;
    const membersSnap = await db
      .collection('groups').doc(groupId)
      .collection('members')
      .where('role', 'in', ['cr', 'acr'])
      .get();

    for (const memberDoc of membersSnap.docs) {
      totalCRACR += 1;
      const memberUid = memberDoc.id;
      const memberData = memberDoc.data();
      const oldMobile = String(memberData.mobile || '').trim();

      const subDocRef = db
        .collection('groups').doc(groupId)
        .collection('members').doc(memberUid)
        .collection('private').doc('mobile');

      const subDocSnap = await subDocRef.get();

      if (subDocSnap.exists) {
        alreadyHadSubDoc += 1;
        continue; // never overwrite an existing value
      }

      if (!oldMobile) {
        noOldMobile += 1;
        console.log(`  [SKIP] ${groupId}/${memberUid} (${memberData.name || 'unknown'}) — no old mobile on file either`);
        continue;
      }

      console.log(`  [${DRY_RUN ? 'WOULD MIGRATE' : 'MIGRATING'}] ${groupId}/${memberUid} (${memberData.name || 'unknown'}, role=${memberData.role}) — "${oldMobile}"`);

      if (!DRY_RUN) {
        try {
          await subDocRef.set({ value: oldMobile });
          migrated += 1;
        } catch (e) {
          errors += 1;
          console.error(`    ERROR writing ${groupId}/${memberUid}:`, e.message);
        }
      } else {
        migrated += 1; // count as "would migrate" for the summary
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total CR/ACR members scanned: ${totalCRACR}`);
  console.log(`Already had private/mobile (skipped, untouched): ${alreadyHadSubDoc}`);
  console.log(`No old mobile value to migrate: ${noOldMobile}`);
  console.log(`${DRY_RUN ? 'Would migrate' : 'Migrated'}: ${migrated}`);
  if (!DRY_RUN) console.log(`Errors: ${errors}`);
  console.log(DRY_RUN ? '\nThis was a dry run — nothing was written. Re-run without --dry-run to apply.\n' : '\nDone.\n');
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
