"""
build_canonical_questions_index.py

canonical-questions/{DEPT}/{Y#T#}/{COURSE}/*.json ফোল্ডার স্ক্যান করে
একটা master index JSON বানায়, যাতে website browser থেকে সরাসরি ফোল্ডার
listing না করেও dept -> term -> course -> question-file তালিকা পড়তে
পারে (কারণ static hosting-এ browser দিয়ে directory listing করা যায় না)।

USAGE (website repo root থেকে):
    python scripts/build_canonical_questions_index.py

INPUT:
    public/canonical-questions/{DEPT}/{Y#T#}/{COURSE}/*.json

OUTPUT:
    public/canonical-questions/_index.json
    shape:
    {
      "generated_at": "...",
      "departments": {
        "CSE": {
          "label": "CSE",
          "terms": {
            "Y2T1": {
              "courses": {
                "CSE_2113": {
                  "question_count": 42,
                  "files": ["1000_p1_Q1_a.json", ...]
                }
              }
            }
          }
        }
      }
    }

এই script রিসামেবল/দ্রুত -- শুধু ফাইল-নাম স্ক্যান করে, প্রতিটা JSON
পার্স/খোলে না (৫৬K ফাইলে এটা দ্রুত রাখার জন্য ইচ্ছাকৃত)। প্রতিটা
প্রশ্নের ভেতরের ডেটা (topics, marks, ইত্যাদি) লাগবে শুধু তখন, যখন
ইউজার আসলে সেই course-টা খুলবে -- তখন সেই course-ফোল্ডারের ফাইলগুলো
lazily fetch হবে ফ্রন্টএন্ড থেকে, index থেকে না।

Course code-এর আসল title (human-readable নাম) index-এ নেই এখানে,
কারণ canonical question JSON-এর ভেতরে course.title প্রায়ই null --
সেটা দরকার হলে syllabus_topics_lookup.json থেকে আলাদা resolve করতে
হবে ফ্রন্টএন্ড-সাইডে, এই script-এর দায়িত্ব না।
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timezone

# canonical-questions ফোল্ডার -- এই স্ক্রিপ্ট repo root থেকে চালানো হবে
# ধরে নিয়ে রিলেটিভ পাথ ব্যবহার করা হয়েছে।
ROOT = Path("public/canonical-questions")
OUTPUT = ROOT / "_index.json"

# এই নামের ফোল্ডারগুলো index-এ বাদ দেওয়া হবে (এখনো ঠিকভাবে
# organize/resolve হয়নি বলে আলাদা বাকেট)
SKIP_DIR_NAMES = {"_UNRESOLVED_COURSE_CODE", "_UNRESOLVED_YEAR_TERM"}


def main():
    if not ROOT.exists():
        print(f"ERROR: {ROOT} পাওয়া যায়নি। এই script অবশ্যই repo root "
              f"(যেখানে 'public' ফোল্ডার আছে) থেকে চালাতে হবে।",
              file=sys.stderr)
        sys.exit(1)

    departments = {}
    total_files = 0
    skipped_dirs = 0

    dept_dirs = sorted([d for d in ROOT.iterdir() if d.is_dir()])

    for dept_dir in dept_dirs:
        dept_code = dept_dir.name
        if dept_code in SKIP_DIR_NAMES:
            skipped_dirs += 1
            continue

        terms = {}
        term_dirs = sorted([d for d in dept_dir.iterdir() if d.is_dir()])

        for term_dir in term_dirs:
            term_code = term_dir.name
            courses = {}
            course_dirs = sorted([d for d in term_dir.iterdir() if d.is_dir()])

            for course_dir in course_dirs:
                course_code = course_dir.name
                files = sorted([f.name for f in course_dir.glob("*.json")])
                if not files:
                    continue
                courses[course_code] = {
                    "question_count": len(files),
                    "files": files,
                }
                total_files += len(files)

            if courses:
                terms[term_code] = {"courses": courses}

        if terms:
            departments[dept_code] = {"label": dept_code, "terms": terms}

        print(f"  {dept_code}: {sum(len(t['courses']) for t in terms.values())} "
              f"course, {sum(c['question_count'] for t in terms.values() for c in t['courses'].values())} প্রশ্ন-ফাইল")

    index = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_question_files": total_files,
        "departments": departments,
    }

    OUTPUT.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    print()
    print(f"✅ Index লেখা হয়েছে: {OUTPUT}")
    print(f"   মোট department: {len(departments)}")
    print(f"   মোট প্রশ্ন-ফাইল: {total_files}")
    if skipped_dirs:
        print(f"   বাদ দেওয়া হয়েছে {skipped_dirs} unresolved ফোল্ডার "
              f"({', '.join(SKIP_DIR_NAMES)})")


if __name__ == "__main__":
    main()
