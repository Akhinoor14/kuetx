# -*- coding: utf-8 -*-
"""
migrate_teacher_email.py
=========================

এক-বারের (one-off) মাইগ্রেশন স্ক্রিপ্ট — পুরো scraper আবার না চালিয়ে,
`facultyPublications` কালেকশনের যেসব ডকুমেন্টে পুরনো `teacher_email`
(snake_case) ফিল্ড আছে কিন্তু `teacherEmail` (camelCase) নেই, শুধু
সেগুলোতে camelCase ফিল্ডটা যোগ করে দেয়।

কেন এটা দরকার
--------------
kuet_faculty_scraper.py-এর পুরনো একটা রান snake_case ফিল্ড নিয়ে
Firestore-এ পুশ হয়ে গিয়েছিল (fix-এর আগে)। ফিক্স স্ক্রিপ্টে বসানো
আছে ঠিকই, কিন্তু আবার পুরো scrape চালাতে গেলে Firestore free-tier
(Spark plan)-এর দৈনিক 20,000 write quota শেষ হয়ে যাচ্ছে
(google.api_core.exceptions.ResourceExhausted: 429 Quota exceeded),
কারণ পুরো ৬০০০+ publication + ৪৩৬ teacher প্রতিবার নতুন করে লেখা হয়।

এই স্ক্রিপ্ট শুধু READ করে বের করে কোন ডকুমেন্টে fix দরকার, আর শুধু
সেই ডকুমেন্টগুলোতেই ছোট একটা field-rename write করে — তাই write count
অনেক কম (broken ডকুমেন্ট সংখ্যার সমান, পুরো কালেকশনের সমান না)।

Manual-edit safety
-------------------
scraper-এর মতোই, isManuallyEdited: true থাকা ডকুমেন্ট কখনো ছোঁয়া হয়
না — শিক্ষকের নিজের করা এডিট সবসময় জেতে।

Usage
-----
    # প্রথমে dry-run দিয়ে দেখুন কী কী বদলাবে, কিছু লিখবে না:
    python migrate_teacher_email.py --dry-run

    # আসল রান (ডেটা লিখবে):
    python migrate_teacher_email.py

Auth
----
kuet_faculty_scraper.py-এর মতোই — env var FIREBASE_SERVICE_ACCOUNT_JSON-এ
পুরো Firebase service-account JSON বসাতে হবে (GitHub Actions secret,
অথবা লোকাল রানের জন্য আপনার শেলে export করে)।
"""

import os
import sys
import json
import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("migrate_teacher_email")


def get_firestore_client():
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        raw_cred = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if not raw_cred:
            logger.error(
                "FIREBASE_SERVICE_ACCOUNT_JSON env var missing. Set it to the "
                "full Firebase service-account JSON before running this script."
            )
            sys.exit(1)
        cred = credentials.Certificate(json.loads(raw_cred))
        firebase_admin.initialize_app(cred)

    return firestore.client()


def migrate(dry_run: bool = False):
    db = get_firestore_client()
    pubs_col = db.collection("facultyPublications")

    logger.info("Scanning facultyPublications for docs missing teacherEmail...")

    to_fix = []          # list of (doc_ref, teacher_email_value)
    manually_edited_skipped = 0
    already_ok = 0
    unfixable_no_source_email = 0

    # Full-collection stream — reads only, cheap on quota (50k free reads/day).
    for snap in pubs_col.stream():
        data = snap.to_dict() or {}

        if data.get("teacherEmail"):
            already_ok += 1
            continue

        if data.get("isManuallyEdited"):
            manually_edited_skipped += 1
            continue

        legacy_email = data.get("teacher_email")
        if not legacy_email:
            unfixable_no_source_email += 1
            logger.warning(f"  doc {snap.id} has neither teacherEmail nor teacher_email — skipping")
            continue

        to_fix.append((snap.reference, legacy_email))

    logger.info(
        f"Scan done. already_ok={already_ok} needs_fix={len(to_fix)} "
        f"manually_edited_skipped={manually_edited_skipped} "
        f"unfixable_no_source_email={unfixable_no_source_email}"
    )

    if not to_fix:
        logger.info("Nothing to migrate. All done.")
        return

    if dry_run:
        logger.info(f"[DRY RUN] Would write teacherEmail to {len(to_fix)} documents. "
                     f"No writes performed. Re-run without --dry-run to apply.")
        for ref, email in to_fix[:10]:
            logger.info(f"  [DRY RUN] {ref.id} -> teacherEmail={email}")
        if len(to_fix) > 10:
            logger.info(f"  ...and {len(to_fix) - 10} more")
        return

    # Batch-write in chunks of 400 (Firestore batch limit is 500 writes).
    written = 0
    batch = db.batch()
    batch_ops = 0

    for ref, email in to_fix:
        batch.update(ref, {"teacherEmail": email})
        batch_ops += 1
        written += 1
        if batch_ops >= 400:
            batch.commit()
            logger.info(f"  committed batch, {written}/{len(to_fix)} written so far")
            batch = db.batch()
            batch_ops = 0

    if batch_ops > 0:
        batch.commit()

    logger.info(f"Migration done. teacherEmail written to {written} documents "
                f"(writes used: ~{written}, well under the 20,000/day free quota).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                         help="শুধু দেখাবে কী বদলাবে, Firestore-এ কিছু লিখবে না")
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)
