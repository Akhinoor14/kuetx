# KUETX — Publications Feature — Handoff Doc (Merged, updated)

> এই doc দুইটা আলাদা handoff-এর merge — (১) publications feature-এর
> ডিজাইন/decision/changelog, (২) local dry-run + deployment testing
> ধাপ। এই আপডেটে (আজকের session) local deploy actually চালিয়ে যা যা
> হয়েছে/ভাঙছে তার latest status যোগ করা হলো। আগের HANDOFF.md (faculty
> directory + auto-verify) আর তার পরের profile/publications scraper
> session-এর উপর ভিত্তি করে বানানো।

---

## 0. TL;DR — এখন ঠিক কী অবস্থায় আছে

- ✅ Zip merge, git status verify, `.gitignore` fix (pycache + service
  account key pattern) — done
- ✅ `firestore.rules` deploy — done, এবং **publications read এখন
  signed-in-only করা হয়েছে** (bulk-scrape friction বাড়ানোর জন্য,
  bilow দেখো কেন)
- ✅ Local env-এ Firebase service account key দিয়ে scraper সফলভাবে সব
  ২৪টা department (৪৩৬ জন teacher) scrape করেছে — **scraping logic
  proven correct**, `Teacher.department` আসলেই dept code (CSE, EEE...)
  তা dry-run JSON দিয়ে confirmed
- ✅ **`push_to_firestore()`-এর `FieldPath` bug fix করা হয়েছে এবং
  re-run করে confirmed** — final successful summary:
  `faculty written=436 skipped(no-email)=0 publications written=5856
  publications skipped(manual-edit)=0`
- ✅ **Firebase Console-এ visually confirmed** — `facultyDirectory` ও
  `facultyPublications` দুটো collection-এই data সঠিক format-এ ঢুকেছে
  (screenshot দিয়ে যাচাই করা হয়েছে)
- ✅ **GitHub-এ push করা হয়ে গেছে এবং daily cron confirmed working** —
  Actions ট্যাবে "KUET Faculty Directory Scrape" run দেখা যাচ্ছে,
  event type "Scheduled" (মানে ৩:১০ AM BD time-এ নিজে থেকেই চলেছে,
  manual trigger না), status ✅ green, 25m 25s সময় লেগেছে
- ⬜ Local `npm run dev` test **ইচ্ছাকৃতভাবে skip করা হয়েছে** (ইউজার
  স্থির করেছে GitHub push-ই যথেষ্ট, Vercel deploy হলে live site-এ
  দেখা যাবে)
- ⬜ End-to-end UI test (live deployed site-এ) এখনো বাকি
- ⬜ `documentation/03-features/faculty-module/CURRENT.md`-এ entry
  করা বাকি

**এই session-এ publications migration কার্যকরভাবে সম্পূর্ণ। পরের
session-এ শুরু করার moto বড় নতুন কাজ #9-এ দেখো।**

---

## 1. আজকের session-এ যা যা ঘটেছে, ক্রম অনুযায়ী

### ক. Zip merge ও git hygiene
- `KUETX_full_project.zip` local repo (`D:\Skill\Website\kuetx`)-তে
  merge করা হয়েছে; `git status` দিয়ে ১০টা publications-related
  file-ই confirmed present (changelog table #3-এর সাথে মিলেছে)
- `scripts/__pycache__/*.pyc` ভুলবশত staged ছিল — `git rm -r --cached
  -f scripts/__pycache__` দিয়ে untrack করা হয়েছে
- `.gitignore`-এ notun entries যোগ করা হয়েছে:
  ```
  *firebase-adminsdk*.json
  *serviceAccount*.json
  *.pem
  *.key
  ```
  কারণ: Firebase service-account key file local-এ download করা
  হয়েছিল টেস্টের জন্য, এটা যেন ভুলেও commit না হয়

### খ. Dry-run verify (CSE, 39 teacher)
- `python kuet_faculty_scraper.py --dry-run --only-department CSE`
  সফল — JSON output manually inspect করে দেখা গেছে:
  - `title`, `authors`, `venue`, `year` সব আলাদা আলাদা field-এ ঠিকমতো
    parse হচ্ছে (raw_citation-এ mixed হয়ে যাচ্ছে না)
  - `department: "CSE"` — dept code সঠিক, full name না (আগের
    unverified concern এখন **confirmed OK**)
  - Minor cosmetic issue: কিছু publication-এ `pages` field
    incomplete/trailing dash (যেমন `"167481-"`) — এটা critical না,
    UI crash করবে না, চাইলে পরে ঠিক করা যায়

### গ. Firestore rules deploy + security hardening
- `firebase deploy --only firestore:rules` — **সফল** (pre-existing
  unused-function warning গুলো harmless, publications-related না)
- আলোচনার পর সিদ্ধান্ত: aggregated publication dataset (৩২৮+ entries,
  KUET-এর নিজের website-এ scattered কিন্তু এখানে centralized) বাল্ক
  scrape-copy থেকে কিছুটা friction দিতে **`facultyPublications` read
  rule public থেকে signed-in-only করা হয়েছে** —
  ```
  match /facultyPublications/{docId} {
    allow read: if isSignedIn();   // আগে ছিল: if true
    ...
  }
  ```
  এটা `/publications` route-এর signed-out demo browsing-কে affect
  করে না (route guard আগে থেকেই `RequireStudentMode`/`RequireFaculty`
  দিয়ে ছিল — এই rule change শুধু client SDK-কে সরাসরি bypass করে bulk
  read করার loophole বন্ধ করেছে)। **সিদ্ধান্তটা business-value
  protection বনাম Guest Room demo completeness-এর trade-off, একবার
  চিন্তা করে নিও যদি ভবিষ্যতে signed-out publications preview লাগে।**

### ঘ. Full scrape (সব ২৪ department, ৪৩৬ teacher)
- Local env-এ PowerShell দিয়ে
  `$env:FIREBASE_SERVICE_ACCOUNT_JSON` সেট করে
  `python kuet_faculty_scraper.py` (flag ছাড়া, পুরো run) চালানো
  হয়েছে
- **Scraping অংশ সম্পূর্ণ সফল**: ৪৩৬ জন teacher, ২৪ department,
  JSON snapshot লেখা হয়েছে (`kuet_faculty_data.json`)
- ৩ জন teacher-এর profile page-এ KUET website নিজেই 500 error
  দিয়েছে (আমাদের bug না):
  - Dr. Mahmudul hasan Mizan (CE) — `kuet.ac.bd/ce/mahmud_rcc`
  - Nayeema Hasan (EEE) — `kuet.ac.bd/eee/nayeema`
  - A.K.M. Selim Reza (MATH) — `kuet.ac.bd/math/selim`

  এই ৩ জনের directory info (নাম/email/photo) ঠিকই save হবে, শুধু
  education/experience/publications এখন খালি থাকবে। GitHub Actions
  daily cron future run-এ retry হবে automatically; যদি KUET-এর
  server-side সমস্যা স্থায়ী হয়, তাহলে ওই ৩ জন teacher নিজে login করে
  `/faculty/profile`-এ গিয়ে publication manually add করতে পারবেন
  (`isManuallyEdited: true` হয়ে যাবে, future scrape সেটা touch করবে
  না)।

## 2. 🔴 এখনো unresolved — সবচেয়ে জরুরি জিনিস

### #1 — `push_to_firestore()`-এ `FieldPath` AttributeError (fixed, re-test বাকি)

Full scrape শেষে Firestore-এ push করার সময় crash:
```
AttributeError: module 'firebase_admin.firestore' has no attribute 'FieldPath'
```

**কারণ**: `firebase_admin.firestore` module নতুন version-এ (এই session-এ
installed হয়েছে `firebase-admin==7.5.0`) `FieldPath` re-export করে না।
পুরনো version-এ হয়তো করত, তাই script লেখার সময় এই bug ধরা পড়েনি।

**Fix প্রয়োগ করা হয়েছে** (`scripts/kuet_faculty_scraper.py`-এ,
`push_to_firestore()` function-এর ভিতরে):
```python
# আগে:
from firebase_admin import credentials, firestore
...
firestore.FieldPath.document_id(), "in", chunk

# এখন:
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.field_path import FieldPath
...
FieldPath.document_id(), "in", chunk
```

**⬜ এখনো বাকি**: এই fix করা file local repo-তে বসানো হয়েছে, কিন্তু
**পুরো scrape আবার চালিয়ে confirm করা হয়নি যে push সফলভাবে শেষ হয়**।
পরের session-এ প্রথম কাজ এটাই — `python kuet_faculty_scraper.py`
(flag ছাড়া) আবার চালিয়ে শেষ পর্যন্ত সফল summary line (কতগুলো written,
কতগুলো skipped) দেখা পর্যন্ত অপেক্ষা করা।

> **Note**: `push_to_firestore()`-এ আর কোথাও `firestore.` prefix দিয়ে
> কিছু call হচ্ছে কিনা check করা হয়েছে — শুধু `firestore.client()`
> আছে যেটা ঠিকই re-export হয়, তাই আর কোনো একই ধরনের বাগ থাকার কথা না।
> তাও পুরো run finish হওয়া পর্যন্ত ১০০% guarantee দেওয়া যাচ্ছে না।

## 3. ⬜ বাকি ধাপ — ক্রম অনুযায়ী (আপডেটেড)

1. **Fix-করা scraper দিয়ে আবার full scrape চালাও** (`python
   kuet_faculty_scraper.py`, flag ছাড়া) — env var (`$env:FIREBASE_
   SERVICE_ACCOUNT_JSON`) same PowerShell session-এ set থাকতে হবে
2. Firebase Console → Firestore Database-এ গিয়ে চোখে দেখো:
   - `facultyDirectory`-তে ৪৩৬ জন (বা কাছাকাছি) teacher ঢুকেছে
   - `facultyPublications`-এ publication doc-গুলো ঢুকেছে, `source:
     "scraper"`, `isManuallyEdited: false` ঠিক আছে
3. Manual-wins logic টেস্ট করো (আগের doc-এর ধাপ E অপরিবর্তিত):
   - একটা doc-এ manually `isManuallyEdited: true` সেট করো
   - আবার scraper চালাও, log-এ `publications_skipped_manual` count
     দেখো, doc অপরিবর্তিত আছে কিনা যাচাই করো
4. `npm install && npm run dev` — local frontend test, কোনো syntax/
   import error আছে কিনা দেখা (এই session-এ npm install sandbox-এ করা
   যায়নি network restriction-এর কারণে; local Windows machine-এ এটাই
   প্রথমবার real build check হবে)
5. End-to-end UI test:
   - Test faculty account দিয়ে `/faculty/profile` → Publications
     card দেখা যাচ্ছে কিনা, "Add" দিয়ে notun publication যোগ করা
   - Student account দিয়ে `/publications` → দেখা যাচ্ছে কিনা (এখন
     signed-in লাগবে, আগে public ছিল — এটা মাথায় রেখো টেস্ট করার সময়)
   - department filter কাজ করছে কিনা
   - Edit করে Firestore-এ `isManuallyEdited: true` হচ্ছে কিনা
6. সব ঠিক থাকলে `git add . && git commit -m "..." && git push` —
   এতে GitHub Actions daily cron (রাত ৩টা BD time) active হবে; push
   এর পরপরই Actions ট্যাব থেকে manual "Run workflow" দিয়ে প্রথম run
   এখনই দেখে নেওয়া যায়
7. `documentation/03-features/faculty-module/CURRENT.md`-এ এই feature
   entry করা (convention অনুযায়ী)

## 4. Architecture decision — "manual-wins" flag (অপরিবর্তিত)

```
facultyPublications/{docId}
  ...existing fields (title, authors, venue, year, link, ...)
  source: 'scraper' | 'manual'
  isManuallyEdited: boolean       ← key field
  teacherName, teacherDeptCode    ← denormalized for browse-page filtering
```

- Scraper প্রতিবার push করার আগে batch-এ (৩০-doc chunk, Firestore `in`
  query limit) existing doc-গুলো check করে — যেগুলোর
  `isManuallyEdited == true`, সেগুলো **সম্পূর্ণ skip** করে
- Frontend-এর `facultyPublicationsSync.js`-এর `addPublication` এবং
  `updatePublication` — দুটোই সবসময় `isManuallyEdited: true` সেট করে
- কোনো "revert to scraped version" নেই — একবার manual হয়ে গেলে,
  চিরকাল manual-owned থাকবে

## 5. ফাইল-ভিত্তিক changelog (অপরিবর্তিত + notun fix)

| ফাইল | অবস্থা | কী আছে |
|---|---|---|
| `scripts/kuet_faculty_scraper.py` | edited (+ notun fix আজ) | `Publication` dataclass-এ `source`/`isManuallyEdited`; manual-wins skip logic; `--only-department` flag; **আজকের fix: `FieldPath` import `google.cloud.firestore_v1.field_path` থেকে, `firebase_admin.firestore`-এর বদলে** |
| `firestore.rules` | edited (+ আজ notun change) | `facultyPublications/{docId}` rule — **আজ read `if true` থেকে `if isSignedIn()` করা হয়েছে**, write শুধু নিজের `teacherEmail` |
| `src/lib/facultyPublicationsSync.js` | নতুন | CRUD + subscriptions |
| `src/components/PublicationEditModal.jsx` | নতুন | Add/edit form modal |
| `src/components/PublicationsCard.jsx` | নতুন | Profile preview card |
| `src/pages/PublicationsBrowse.jsx` | নতুন | Standalone browse page |
| `src/pages/faculty/FacultyProfile.jsx` | edited | `PublicationsCard` মাউন্ট |
| `src/nav.js` / `src/nav-faculty.js` | edited | Nav rows |
| `src/App.jsx` | edited | দুই lazy route |
| `scripts/.gitignore` | edited (আজ) | service-account key patterns যোগ |

## 6. জানা সমস্যা / সাবধানতা (আপডেটেড)

- **`push_to_firestore()` FieldPath bug** — fixed, but re-test pending
  (#1 দেখো)
- **৩ জন teacher-এর profile page KUET server-এ 500 error দেয়** —
  আমাদের bug না, retry/manual-entry দিয়ে resolve হবে, block করছে না
- **Publications এখন signed-in-only** (আগে public ছিল) — যদি Guest
  Room demo-তে publications preview দরকার হয় ভবিষ্যতে, এই rule আবার
  আলোচনা করতে হবে
- **`pages` field-এ মাঝেমধ্যে incomplete range** (যেমন trailing `-`) —
  cosmetic, non-blocking
- **CSE বাদে অন্য department-এর HTML template পুরোপুরি verify করা
  হয়নি** যদিও full scrape সফলভাবে সব department থেকে data এনেছে (৩ জন
  বাদে) — parsing quality সব department-এ সমান কিনা spot-check করা
  ভালো
- **Mobile layout QA বাকি**
- **`documentation/03-features/faculty-module/CURRENT.md` entry বাকি**

## 7.5. পরের session-এর জন্য — নতুন feature request (এই session-এই আলোচিত, শুরু করা হয়নি)

Publications migration শেষে (এবং live site দেখার পরে) ইউজার দুইটা বড়
আলাদা feature-এর কথা বলেছে, ইচ্ছাকৃতভাবে **এই session-এ শুরু করা
হয়নি** — পরের session-এর প্রথম কাজ এইগুলো। দুটোই independent, যেকোনো
ক্রমে করা যায়, কিন্তু ৭.৫.১ (Publications UI) ছোট/সহজ, ৭.৫.২ (signup
flow) বড়।

---

### 7.5.1 — Publications browse page UI upgrade (ছোট কাজ)

**বর্তমান অবস্থা** (`src/pages/PublicationsBrowse.jsx`, লাইন ~119-124):
প্রতিটা publication row-এ teacher-এর নাম শুধু plain colored text
হিসেবে দেখানো হয় — click করা যায় না:
```jsx
<div style={{ fontSize: 11.5, color: 'var(--accent)', ... }}>
  {pub.teacherName || pub.teacherEmail}
  {pub.teacherDeptCode ? ` · ${DEPT_NAME_BY_CODE[pub.teacherDeptCode]}` : ''}
</div>
```

**যা বানাতে হবে** — এই text-এর জায়গায় দুইটা button:

**(A) "View Details" button** — click করলে একটা modal/panel খুলবে
যেখানে:
- Teacher-এর `facultyDirectory` doc থেকে full info: naam, designation,
  department, photo, education, experience (এই data ইতিমধ্যেই
  Firestore-এ আছে, নতুন scrape লাগবে না — শুধু UI বানাতে হবে)
- ওই teacher-এর **সব** publication-এর list (facultyPublications থেকে
  `teacherEmail` দিয়ে filter — `subscribeToTeacherPublications` ফাংশন
  ইতিমধ্যেই `facultyPublicationsSync.js`-এ আছে, ব্যবহার করা যাবে)
- সবকিছু **আমাদের নিজের site-এর মধ্যেই**, বাইরের লিংকে পাঠানো হবে না

**(B) "View Publication Link" button** — যদি ওই publication doc-এ
`link` field থাকে (scraper অনেক publication-এ এটা পপুলেট করে —
Google Scholar/journal link), সেটা দেখানোর/খোলার button। `link` field
না থাকলে এই button hide/disable থাকবে।

**Implementation নোট**:
- নতুন কোনো data/scraper change লাগবে না — সব field ইতিমধ্যেই আছে
  (`facultyDirectory`, `facultyPublications` উভয় collection-এই)
- `PublicationsBrowse.jsx`-এ নতুন state (`selectedTeacherEmail` জাতীয়)
  + একটা নতুন modal component বানাতে হবে (হয়তো
  `TeacherDetailModal.jsx` বা এই রকম নাম) যেটা `facultyDirectory` +
  filtered publications দুটোই লোড করে দেখাবে

---

### 7.5.2 — Faculty signup flow restructure + community-submitted publications (বড় কাজ)

**দুইটা আলাদা "Add" flow, দুই রকম permission**:

| কে add করছে | Approval লাগবে? | কোথা থেকে |
|---|---|---|
| Teacher নিজে, নিজের `/faculty/profile` থেকে | ❌ না, direct add | **ইতিমধ্যেই আছে** — `PublicationsCard.jsx`-এর "+ Add" বাটন, `facultyPublicationsSync.js`-এর `addPublication()`। কোনো change দরকার নেই। |
| Student/alumni/যে কেউ, publications browse page থেকে | ✅ হ্যাঁ, Founder approval লাগবে | **নতুন বানাতে হবে** |

**নতুন community-submit flow যা বানাতে হবে**:
1. `PublicationsBrowse.jsx`-এ (`/publications`, শুধু student-facing
   route-এ) একটা নতুন "+ Add" button — যে কোনো signed-in student/
   user submit করতে পারবে কোনো teacher-এর publication (যেটা তারা
   জানে কিন্তু sistem-এ নেই)
2. Submit করলে সরাসরি `facultyPublications`-এ না লিখে, একটা নতুন
   pending/review collection-এ যাবে (যেমন
   `pendingPublicationSubmissions/{id}` — নতুন collection, নতুন
   firestore.rules) — pattern-টা `manualVerifyRequests.js`-এর সাথে
   হুবহু মেলে, ওটাই টেমপ্লেট হিসেবে ব্যবহার করা যায়
3. Founder-এর Admin dashboard-এ একটা নতুন "Pending Publications" tab
   (AdminDashboard.jsx-এর existing "Manual Verify"/approval tab-গুলোর
   প্যাটার্নে) — approve করলে `facultyPublications`-এ আসল doc হিসেবে
   লেখা হবে (`source: 'community'`, `isManuallyEdited: true` যাতে
   scraper কখনো touch না করে), reject করলে pending collection থেকে
   মুছে যাবে

**Faculty signup/Register flow restructure** (আগের discussion থেকে,
এখনো relevant):
1. **Step 1 — শুধু campus email**: signup form-এ প্রথমে শুধু email
   field (`*.kuet.ac.bd`)। Submit করলে `facultyDirectory`-তে match
   check হবে সাথে সাথে।
2. **Match হলে**: naam, department, designation-এর summary/preview
   দেখাবে ("আমরা আপনার এই তথ্য পেয়েছি — কনফার্ম করুন")। Confirm করলে
   account **auto-verified**।
3. **Match না হলে**: normal fields manually fill, **manual
   verification** (Founder review) flow-এ যাবে, আগের মতোই।

**Backend logic ইতিমধ্যেই বানানো আছে** — `src/lib/facultyDirectoryMatch.js`:
- `lookupFacultyDirectoryEntry(email)`, `tryAutoVerifyFacultyFromDirectory(uid, {name, email})`
- `manualVerifyRequests.js`-এর `ensureManualVerifyRequest()` থেকে call
  হয়, কিন্তু এখন `name` + `email` + dept সব একসাথে লাগে
  (early-return, লাইন ৭৬-৭৮) — মূল কাজ **UI/form-flow পুনর্গঠন**
  (email-first, then preview, then confirm ধাপে ভাগ করা), backend
  logic re-order/re-wire করলেই চলবে।

**Faculty Profile page redesign** — screenshot দেখে confirmed:
- বর্তমান profile page-এ IDENTITY, CONTACT & DISPLAY, AT A GLANCE
  card-গুলো আছে, কিন্তু scraped `education`/`experience` কোথাও
  দেখানো হচ্ছে না
- Redesign-এ teacher-এর `facultyDirectory` থেকে scraped সব info
  (education, experience) নতুন card হিসেবে profile page-এ যোগ করতে
  হবে

### পরের session শুরুর আগে যা দেখতে হবে
- বর্তমান signup/Register component কোথায়, কোন ধাপে
  `ensureManualVerifyRequest` call হয়
- `AdminDashboard.jsx`-এর existing approval-tab প্যাটার্ন (Manual
  Verify tab) — নতুন Pending Publications tab-এর জন্য টেমপ্লেট
- `facultyDirectoryMatch.js`-এর security note — `verifiedFacultyEmails`
  write rule বর্তমানে যেকোনো signed-in user লিখতে পারে (Spark/free
  plan-এ Cloud Function দিয়ে server-side check সম্ভব না) — পুরনো known
  gap, মাথায় রাখা ভালো

## 8. Quick reference — কমান্ড (আপডেটেড, Windows/PowerShell)

```powershell
# Firebase key লোড করা (প্রতি নতুন PowerShell session-এ লাগবে)
$json = Get-Content "C:\Users\AKHINOOR\Downloads\kuetx-8a184-firebase-adminsdk-fbsvc-6bb369618b.json" -Raw
$env:FIREBASE_SERVICE_ACCOUNT_JSON = $json

# Setup
cd D:\Skill\Website\kuetx\scripts
pip install -r requirements.txt

# Test — one department, no writes
python kuet_faculty_scraper.py --dry-run --only-department CSE

# Full run — all departments, real write (fix করার পর এইটাই পরের কাজ)
python kuet_faculty_scraper.py

# Deploy rules (already done, re-run safe/idempotent)
cd D:\Skill\Website\kuetx
firebase deploy --only firestore:rules

# Frontend
npm install
npm run dev
```
