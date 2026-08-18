# Faculty Question Bank — In-App PDF Viewer Fix

## সমস্যা

Faculty side-এ Question Bank দেখানোর দুইটা জায়গা ছিল:

1. `/faculty/question-bank` (browse list) — এখানে `QuestionBank.jsx` reuse করা হয়, paper-এ ক্লিক করলে `openPaper()` চলে `/question-bank/view`-এ navigate করে।
2. `FacultyClassDetail.jsx`-এর `QuestionBankTab` (assignment-scoped mini list, class detail পেজের ভেতরে) — এখানে raw `<a href target="_blank">` ছিল, সরাসরি R2 file URL-এ যেত।

দুই জায়গাতেই paper open করলে in-app PDF reader (`QuestionBankViewer.jsx`) খুলত না:

- `/question-bank/view` route টা `RequireStudentMode`-এ wrap করা ছিল, যেটা genuine faculty account-কে ব্লক করে "This page is for student accounts" মেসেজ দেখাত।
- `QuestionBankTab`-এর raw `<a>` link কখনোই in-app viewer route ব্যবহার করত না — সরাসরি ব্রাউজারে নতুন ট্যাবে/ডাউনলোড হিসেবে খুলত।

## ফিক্স

### ১. `src/components/RequireStudentMode.jsx`
নতুন optional prop `allowFaculty` যোগ করা হয়েছে (default `false`, তাই বাকি সব student-only route অপরিবর্তিত থাকে)। `true` হলে genuine faculty account-ও pass করবে — ঠিক Founder bypass-এর মতোই আচরণ।

### ২. `src/App.jsx`
`/question-bank/view` route-এ `allowFaculty` prop পাস করা হয়েছে, যেহেতু এই route আসলে student ও faculty দুই পাশের জন্যই shared একমাত্র in-app viewer।

### ৩. `src/pages/faculty/FacultyClassDetail.jsx`
`QuestionBankTab`-এ raw `<a href target="_blank">` সরিয়ে student-side `openPaper()`-এর মতোই `navigate('/question-bank/view?src=...&title=...')` pattern বসানো হয়েছে। `useNavigate` import যোগ করা হয়েছে।

## যা পরিবর্তন হয়নি

- অন্য কোনো student-only route (`/profile`, `/courses`, ইত্যাদি) — সবগুলো এখনো আগের মতোই genuine faculty-কে ব্লক করে, কারণ `allowFaculty` default `false`।
- Provider account handling — অপরিবর্তিত।
- Firestore rules / security boundary — কোনো data-access change হয়নি, শুধু route-level UI gate।
