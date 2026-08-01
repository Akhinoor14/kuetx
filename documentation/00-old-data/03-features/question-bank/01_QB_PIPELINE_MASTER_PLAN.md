# Question Bank — R2 + Upload Pipeline: Master Plan
_As of Jul 14, 2026 — read this once, it replaces re-explaining the whole thing again._

---

## 1. What you're building (two separate things, don't mix them up)

**A. Syllabus/Question PDFs storage → Cloudflare R2**
This is *not* Firebase Storage. Old PDFs currently sit under `public/questions/...` in
the repo itself (see `questionBankData.js`'s comments) — you're migrating storage to R2
so PDFs aren't bundled into the app/repo anymore.

**B. New upload pipeline** (Campus Lead → Senior Campus Lead review → live)
Campus Lead uploads a PDF with a few dropdowns → auto-renamed to the exact R2 key
format → staged privately → their dept's SCL approves/rejects → on approve, file goes
live and is instantly visible via the existing `useQuestionBankData()` hook. Founder
bypasses review and publishes immediately, for any dept.

These share the same R2 bucket family and the same naming convention, which is why
they're one plan.

---

## 2. Naming convention (locked, do not deviate)

```
public/{DEPT}/{TERM}/{CourseCode}/{ExamType}_{ExamYear}.pdf
```

| Segment | Rule |
|---|---|
| `DEPT` | ⚠️ **See casing conflict below — this is the one open decision.** |
| `TERM` | `Y{1-4}T{0-2}`, e.g. `Y2T1`. T0 = year backlog. |
| `CourseCode` | Whitespace stripped, casing preserved exactly as source data has it |
| `ExamType_ExamYear` | `Regular\|Backlog\|Special_Backlog\|Online` + year, e.g. `Regular_2023` |

Auto-naming **is** fully implemented — you never type the filename. `QBUploadForm.jsx`
collects dept/term/course/examType/examYear as dropdowns + a file picker, and
`qbUploadRequests.js` + the Worker's `/approve` build the exact key server-side. Confirmed
in code, not just planned.

### ⚠️ Casing conflict — needs your decision before first real upload
Three different casings for the same 16 depts exist right now:

| Source | Casing |
|---|---|
| `QB_DEPARTMENTS` in `questionBankData.js` — **what the live app/Worker/upload-form actually use** | `ARCH`, `ChE`, `BECM`, `ESE`, ... |
| Your new `QuestionBank_NEW` folder-structure zip | `Arch`, `ChE`, `BECM`, `ESE`, ... (only `ARCH` vs `Arch` differs) |
| `firestore.rules`' existing `deptCodeFromRoll()` | `ARCH`, `CHE` (all-caps) |

**Only real mismatch: `ARCH` vs `Arch`.** Every other dept code already matches between
`QB_DEPARTMENTS` and your folder zip. Since the live Worker/upload-form/hook all key off
`QB_DEPARTMENTS`, that's authoritative — so when you upload the folder zip to R2, rename
`Arch/` → `ARCH/` first (one folder rename, nothing else touches this).
The `firestore.rules` roll-based auto-verify mismatch (`CHE` vs `ChE`) is a separate
pre-existing bug, unrelated to question bank — not touched here.

---

## 3. R2 bucket layout (what you already built in the dashboard)

```
kuetx-question-bank            (PUBLIC bucket)
  └── public/{DEPT}/{TERM}/{CourseCode}/{Label}.pdf   ← live, browsable

kuetx-question-bank-staging    (PRIVATE bucket, public access OFF)
  └── {requestId}.pdf                                  ← pending review only
```

You already did, confirmed from the conversation/screenshots:
- ✅ Created `kuetx-question-bank` (public access enabled, Standard storage class)
- ✅ CORS on that bucket (`*` origin, GET/HEAD) — correct, don't touch
- ✅ Deployed Worker `worker-app` → `worker-app.kuetx.workers.dev`
- ✅ Bound `QB_BUCKET` → `kuetx-question-bank` on the Worker
- ✅ Created second bucket `kuetx-question-bank-staging` (public access OFF — this is
  the fix for the "staging exposed via guessable requestId" risk you flagged)
- ✅ Bound `QB_STAGING_BUCKET` → `kuetx-question-bank-staging` on the Worker

## 4. What's left to do on the Cloudflare side (concrete steps)

1. **Deploy the updated Worker code** — `cloudflare-worker/src/index.js` and
   `cloudflare-worker/wrangler.toml` in this zip already have the two-bucket split
   wired in (staging bucket for `/stage`, public bucket for `/approve` + listing).
   Replace your local copies with these, then:
   ```bash
   wrangler deploy
   ```
2. **Set Worker secrets/vars** (if not already set) in `wrangler.toml` `[vars]` or
   dashboard → Worker → Settings → Variables:
   - `FIREBASE_PROJECT_ID` — your real Firebase project id (currently placeholder text)
   - `ALLOWED_ORIGIN` — your deployed Vercel domain (currently placeholder text)
3. **Rename `Arch/` → `ARCH/`** in the folder-structure zip before uploading it to R2
   (see casing section above) — everything else in that zip uploads as-is.
4. **Upload the folder structure to R2.** This zip is currently just empty directories
   with a `README.txt` marker in each course folder — it's scaffolding, not content.
   You have two real options:
   - **Recommended:** don't upload the empty folders at all. R2 (like S3) has no real
     concept of empty directories — a "folder" only exists once an object's key
     contains that path. Since real PDFs will create `public/{DEPT}/{TERM}/{Course}/...`
     keys automatically the moment the first paper for that course is approved, uploading
     1146 placeholder objects up front adds nothing the Worker or hook needs — `handleList()`
     builds the tree entirely from whatever real PDF keys exist, at request time.
   - **If you still want them for your own visual reference in the R2 dashboard file
     browser:** upload the renamed folder tree under the `public/` prefix via
     `rclone`/`aws s3 sync` with the R2 S3-compatible endpoint, or drag-and-drop in
     small batches through the dashboard (1146 folders will be slow one-by-one).
     Either way, this is optional and does not block anything else in this plan.

---

## 5. Upload pipeline — how it actually works end to end

```
Campus Lead                     Senior Campus Lead          Fallback
─────────────                   ──────────────────          ────────
QBUploadForm.jsx                QBReviewQueue.jsx            same QBReviewQueue.jsx,
  ↓ picks dept(locked)/term/       (dept-scoped view in         all=true mode
    course/examType/year/file      StaffDashboard.jsx SCL tab)  (Founder/Head of Ops
  ↓ submitQBUpload()             ↓ approveQBUpload(id)          in AdminDashboard)
  ↓  1. Firestore doc created      → Worker /approve moves    Same fallback shape as
       (status: pending)            staging → public          every other request type
  ↓  2. Worker /stage              → Firestore doc: approved   in this codebase (CL apps,
       PDF → staging bucket                                    CR requests, leave requests).
                                 ↓ rejectQBUpload(id, reason)  A dept whose SCL seat is
                                   → Worker /reject deletes     vacant never leaves uploads
                                     staged file                stuck.
                                   → Firestore doc: rejected
```

Founder upload path (`isFounderUpload = true` in `QBUploadForm`/`submitQBUpload`):
Firestore doc is created pre-approved, staged, then immediately promoted — no human
review step, any dept.

**Duplicate-name protection ("same file exists → don't take the input"), exactly as you
asked, is implemented at two layers:**
1. Client-side soft check in `submitQBUpload()` — checks the live tree before even
   creating the Firestore doc, fails fast with a clear message.
2. Server-side hard check in the Worker's `/approve` handler — `env.QB_BUCKET.head(destKey)`
   before writing; returns `409` if something's already there. This is the real backstop
   since the client check is soft (skipped if the Worker is briefly unreachable).

---

## 6. Environment variables — your Vercel check, answered directly

**You don't need to add anything new.** Confirmed from what you showed:
- `VITE_QB_WORKER_URL` — already present in Vercel (added Jul 4)
- All `VITE_FIREBASE_*` keys — already present
- `VITE_UPLOAD_SCRIPT_URL` — already present (unrelated to this feature, leave it)

**One thing to manually verify** (I can't see hidden/sensitive Vercel values): open
`VITE_QB_WORKER_URL` in the Vercel dashboard and confirm its value is exactly your live
Worker URL — `https://worker-app.kuetx.workers.dev` or your custom domain if you've
mapped one. That's the only failure mode left on the env side: a stale or mistyped URL.

Nothing else — no new Firebase config, no new Vercel env var, no `.env.local` changes —
is needed for any file in this zip to work.

---

## 7. Firestore rules — what's done vs. what YOU still need to do

- ✅ **Written and correct**, in `firestore/firestore_rules_addition.txt` — the
  `match /qbUploadRequests/{requestId}` block. Mirrors `clApplications`/
  `manualVerifyRequests` shape: create-scope check (CL can only create for their own
  `batch_dept` groupId, Founder bypasses), read/update gated by
  admin/head-of-ops/SCL-of-that-dept/uploader-themselves, delete always false (audit trail).
- ❌ **NOT yet inserted into your real `firestore.rules`.** I checked the actual
  60KB `firestore.rules` you uploaded — it does **not** contain a `qbUploadRequests`
  match block yet. This still needs to be manually pasted in, near the existing
  `match /manualVerifyRequests/{requestId}` block (line 416 in your current file), since
  they follow the same pattern and belong together for readability.
  **This is the single most important remaining step — the upload pipeline's Firestore
  writes will be rejected by rules until this is added.**

---

## 8. Frontend wiring — what's done vs. what's still open

| Piece | Status |
|---|---|
| `qbUploadRequests.js` (lib) | ✅ done, not yet in main zip — copy into `src/lib/` |
| `QBUploadForm.jsx` | ✅ done, not yet in main zip — copy into `src/components/` |
| `QBReviewQueue.jsx` | ✅ done, not yet in main zip — copy into `src/components/` |
| `founderCategories.js` | ✅ already references `qbUploadRequests` count — copy over your existing `src/lib/founderCategories.js` (it's a full-file replace, not a diff) |
| **`AdminDashboard.jsx` wiring** | ❌ **NOT done.** Confirmed by reading your real file: it does not import `qbUploadRequests.js`, does not subscribe to pending QB requests, and does not render `QBReviewQueue`/`QBUploadForm` anywhere. `buildCountCtx()` (~line 1553) needs a `qbUploadRequests: qbRequests?.length || 0` entry added the same way `manualVerifyRequests` is wired at line 1556, and a "Question Bank Uploads" subcategory panel needs to render `<QBReviewQueue all />` + `<QBUploadForm isFounder />`. |
| **`StaffDashboard.jsx` wiring** | ❌ **NOT done.** `SeniorCampusLeadBlock` (line 281) needs a `<QBReviewQueue dept={dept} />` added alongside its existing CL-application list. `CampusLeadBlock` (line 201) needs a `<QBUploadForm profile={...} groupId={groupId} />` added alongside its existing CR/leave request UI. |

This wiring is genuinely the biggest remaining chunk of work — everything up to this
point (data layer, Worker, rules text, forms) is built; it's just not plugged into the
two dashboard pages yet.

---

## 9. Full checklist — everything, in order

- [ ] **Rename `Arch/` → `ARCH/`** in the folder structure (only if you choose to upload it)
- [ ] Replace local Worker files with `cloudflare-worker/src/index.js` + `wrangler.toml` from this zip, `wrangler deploy`
- [ ] Set real `FIREBASE_PROJECT_ID` and `ALLOWED_ORIGIN` in Worker vars (currently placeholders)
- [ ] Verify `VITE_QB_WORKER_URL` in Vercel points at the live Worker URL
- [ ] **Paste `firestore/firestore_rules_addition.txt` into your real `firestore.rules`**, near the `manualVerifyRequests` block, then deploy rules (`firebase deploy --only firestore:rules`)
- [ ] Copy `frontend/src/lib/qbUploadRequests.js` → your repo's `src/lib/`
- [ ] Copy `frontend/src/components/QBUploadForm.jsx` and `QBReviewQueue.jsx` → your repo's `src/components/`
- [ ] Replace your repo's `src/lib/founderCategories.js` with the one in this zip
- [ ] Wire `QBReviewQueue`/`QBUploadForm` into `AdminDashboard.jsx` (Founder fallback view + count) — see §8
- [ ] Wire `QBReviewQueue`/`QBUploadForm` into `StaffDashboard.jsx` (SCL block + CL block) — see §8
- [ ] Decide: upload the empty folder-structure zip to R2 for visual reference, or skip it (recommended — see §4)
- [ ] Test end-to-end once wired: CL upload → staging bucket has file → SCL sees it in queue → approve → file appears in public bucket + shows up via `useQuestionBankData()`

---

## 10. Notes so you don't have to re-explain the conversation again

- You will **not** re-upload the big `QuestionBank_Folders_verified.zip` again — this
  plan already extracted everything relevant from it (README, dept list, the one casing
  conflict, the 1146-folder list) and that's captured above. No need to resend it.
- The main `kuetx.zip` codebase does **not** yet contain any of the new QB upload files
  — confirmed by direct search. Everything in `frontend/` in this delivery zip is new,
  not a diff.
- `firestore.rules` in your upload is the real 60KB file and does **not** yet contain
  the addition — confirmed directly, not assumed from the conversation log.
