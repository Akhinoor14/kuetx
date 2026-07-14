# Faculty Class Detail — Tab Reorder + Mobile Layout (Phase D)

## যা করা হয়েছে

### ১. Sessions & Count মার্জ হয়ে গেছে Attendance-এ
- আলাদা "Sessions & Count" ট্যাব রিমুভ করা হয়েছে — কারণ attendance save করলেই এখন auto-link হয়ে session count বেড়ে যায় (আগের ফিক্স অনুযায়ী)
- Attendance ট্যাবের উপরে এখন একটা compact strip দেখাবে:
  - কতগুলো ক্লাস logged হয়েছে (of planned total)
  - Plan set/edit করার লিংক
  - "View log" টগল — চাইলে পুরনো session log list দেখা যাবে (ডিফল্ট বন্ধ থাকে, ক্লিন লাগে)
  - "+1 Log Class" বাটন এখন থাকবে শুধু fallback হিসেবে (attendance না নিয়ে ক্লাস হলে ম্যানুয়ালি log করতে), তাই বাটনটা এখন outline style — primary attendance-save বাটনের সাথে visual conflict না হয়

### ২. ট্যাব অর্ডার — দৈনন্দিন ব্যবহারের frequency অনুযায়ী
আগের অর্ডার ছিল setup-checklist এর মতো (Students → Syllabus → Schedule → ...)। এখন real usage অনুযায়ী:

```
১. Attendance (+ Sessions & Count merged)  ← প্রতি ক্লাস ডে
২. Schedule                                 ← daily reference
৩. Notices                                  ← time-sensitive
৪. Marks                                    ← grading period-এ frequent
৫. Syllabus                                 ← rare, reference
৬. Question Bank                            ← exam season only
৭. Students & CR                            ← rare
```

৮টা ট্যাব থেকে কমে ৭টা হয়ে গেছে (merge-এর কারণে)।

### ৩. Mobile layout — top row + "More" sheet
- **Desktop/tablet (>767px):** আগের মতোই পুরো horizontal bar, সব ৭টা ট্যাব একসাথে দেখা যাবে — কোনো পরিবর্তন নেই
- **Mobile (≤767px):** উপরের ৪টা ট্যাব (Attendance, Schedule, Notices, Marks) সবসময় visible থাকবে একটা সমান-চওড়া row-এ, আর একটা "More" বাটন — তাতে tap করলে নিচের ৩টা (Syllabus, Question Bank, Students & CR) একটা ছোট grid sheet-এ খুলবে
- কোনো label wrap/overlap হবে না — প্রতিটা primary বাটন flex-equal width নিয়ে বসে

## যেসব ফাইল বদলেছে
- `src/pages/faculty/FacultyClassDetail.jsx` — TABS order, SessionsTab merged into AttendanceTab, tab bar JSX split (primary row + More sheet)
- `src/index.css` — নতুন CSS ব্লক `.faculty-tabs-wrap`, `.faculty-tabs-primary`, `.faculty-tabs-more-sheet` ইত্যাদি (পুরো ফাইলটাই দেওয়া হয়েছে যেহেতু CSS partial-patch করা রিস্কি, কিন্তু বাকি সব রুল অপরিবর্তিত আছে — নতুন ব্লকটা `.faculty-tabs` সেকশনের ঠিক আগে বসানো)

## যা টেস্ট করা দরকার আপনার পাশ থেকে
- Attendance ট্যাবে save করলে session count ঠিকমতো বাড়ছে কিনা (আগের auto-link logic অক্ষত আছে, শুধু UI জায়গা বদলেছে)
- Mobile-এ (browser resize করে ≤767px-এ) "More" বাটন tap করে Syllabus/QB/Students ঠিকমতো খুলছে কিনা
- Plan set/edit flow attendance strip-এর ভেতর থেকে ঠিকমতো কাজ করছে কিনা

## যা করা হয়নি (স্কোপের বাইরে)
- Desktop tab bar-এ কোনো visual পরিবর্তন করা হয়নি, শুধু order + count কমেছে
- Attendance tab-এর ভেতরের attendance-taking grid UI অপরিবর্তিত (শুধু উপরে session-count strip যোগ হয়েছে)

## Update — manual "+1 Log Class" এখন fully background-এ
আগে top strip-এ prominent বাটন হিসেবে ছিল, এখন সেটা "View log" খুললেই শুধু একটা ছোট text-link হিসেবে দেখা যাবে ("Class held but attendance missed? Log it manually")। Default view-এ শুধু count + plan progress + "View log" — কোনো action বাটন prominent থাকবে না, কারণ normal flow পুরোপুরি auto (attendance save করলেই count বেড়ে যায়)।

---

# Mobile Overflow Audit (Phase E)

পুরো codebase খুঁজে ২টা real mobile overflow bug পাওয়া গেছে এবং ফিক্স করা হয়েছে। (App-এ global `overflow-x: hidden` আছে বলে এগুলো visible horizontal-scroll হিসেবে না, বরং **silent content clipping** হিসেবে ধরা পড়ত — মানে content ডান পাশে কেটে যেত, কোনো scrollbar বা error ছাড়াই।)

## Bug ১: Calculators.jsx — Legacy CGPA term row
- `gridTemplateColumns: '140px 80px 80px 1fr auto'` — ৪টা fixed-px column + gap মিলিয়ে ~340px+, যা ৩৬০-৩৮০px ফোন স্ক্রিনে ফিট করে না
- ফলাফল: ডানদিকের "Done" checkbox ক্লিপ হয়ে যেত বা দেখা যেত না মোবাইলে
- **Fix:** `.legacy-term-row` নামে CSS class করা হয়েছে — ডেস্কটপে আগের ৫-column grid, কিন্তু ≤480px-এ ২ সারিতে wrap করে (label+done উপরে, GPA/credits/points নিচে)

## Bug ২: Courses.jsx — Notes chip popup (NoteChipEditor)
- Notes popup (textarea) `width: 260` fixed, `position: absolute; right: 0` দিয়ে বসানো ছিল কোনো viewport clamp ছাড়া
- Course card একটা wrapped flex row-এর ভেতর চিপ থাকে, তাই চিপের position স্ক্রিনে ভ্যারি করে — popup easily viewport-এর বাইরে চলে যেতে পারত, বিশেষ করে ছোট স্ক্রিনে
- **Fix:** width `min(260px, calc(100vw - 32px))` করা হয়েছে + `maxWidth: calc(100vw - 32px)` — এখন popup কখনো viewport-এর চেয়ে চওড়া হতে পারবে না, তাই দুই পাশ থেকেই কাটা পড়া বন্ধ

## যা চেক করা হয়েছে কিন্তু bug পাওয়া যায়নি (false positives, ঠিকই আছে)
- GuideModal.jsx-এর ২৫০px sidebar — দেখতে risky লাগলেও এর নিজস্ব inline `<style>` block-এ ≤740px breakpoint-এ ঠিকমতো handle করা আছে (sidebar/content toggle + back button)
- সব table (`Attendance.jsx`, `Results.jsx`, `Schedule.jsx`, `FacultyClassDetail.jsx` ইত্যাদি) — এদের প্রায় সবগুলোতেই আগে থেকেই `overflowX: auto` wrapper আছে
- বাকি সব `minWidth`/fixed-width instance গুলো হয় flex-shrink-safe (`flex:1, minWidth:0` pattern), অথবা ছোট আইকন/badge সাইজ (২৬-৩৪px) — এগুলোতে কোনো overflow risk নেই

## যা বদলেছে
- `src/pages/Calculators.jsx` — legacy term row markup + className
- `src/pages/Courses.jsx` — NoteChipEditor popup width clamp
- `src/index.css` — নতুন `.legacy-term-row` responsive CSS ব্লক যোগ হয়েছে
