// Auto-generated from public/KUETx_Guide .js content — DO NOT hand-edit structure casually.
// Renders the in-app KUETx Guide (replaces the old embedded-PDF guide).
export const GUIDE_CATEGORIES = [
  "Overview",
  "Academics",
  "Daily Life",
  "Wellbeing",
  "Finance",
  "Activities",
  "Class Rep",
  "Tools"
];

export const GUIDE_SECTIONS = [
  {
    "num": "00",
    "id": "why",
    "title": "Why Use KUETx?",
    "route": null,
    "icon": "Sparkles",
    "category": "Overview",
    "desc": "KUETx is not a generic student tool. Every single feature is designed around KUET's actual exam…",
    "blocks": [
      {
        "type": "text",
        "text": "KUETx is not a generic student tool. Every single feature is designed around KUET's actual exam system, attendance rules, mark calculation formula, and campus life — no other app does this."
      },
      {
        "type": "table",
        "headers": [
          "Without KUETx",
          "With KUETx"
        ],
        "rows": [
          [
            "Manual attendance counting on paper",
            "Auto-tracked per course, per day, with color-coded shortage alerts"
          ],
          [
            "Guessing your CGPA in your head",
            "Live CGPA calculated from every mark and result you enter"
          ],
          [
            "Forgetting assignment deadlines",
            "Unified tracker with status, priority, and overdue alerts on Dashboard"
          ],
          [
            "Spreadsheets for mark entry",
            "Per-course marks with grade prediction and target hall-mark calculator"
          ],
          [
            "Not knowing KUET academic rules",
            "App warns when you're violating Art. 11.3, 14.2, 16, 20 etc."
          ],
          [
            "Losing past exam papers each term",
            "Question bank — all KUET past papers in one place, downloadable"
          ],
          [
            "No cross-device backup",
            "Firebase real-time sync built in"
          ],
          [
            "Tracking prayers and habits separately",
            "Namaz tracker + Self Evaluation integrated into your Smart Score"
          ],
          [
            "Managing money in a notebook",
            "Income + expense tracker with monthly bar chart and budget alerts"
          ],
          [
            "Not knowing your attendance marks",
            "Auto-calculated per KUET slab formula for each teacher"
          ],
          [
            "No step-by-step exam solutions",
            "Solution Bank — detailed worked solutions to past KUET papers"
          ],
          [
            "Missing teacher contact info",
            "Personal teacher directory linked to courses and schedule"
          ]
        ]
      }
    ]
  },
  {
    "num": "01",
    "id": "getting-started",
    "title": "Getting Started",
    "route": null,
    "icon": "Rocket",
    "category": "Overview",
    "desc": "Go to kuetx.vercel.app. You land on the Dashboard. Most cards will be empty or show zero — that is…",
    "blocks": [
      {
        "type": "subhead",
        "text": "What You See When You First Open the App"
      },
      {
        "type": "text",
        "text": "Go to kuetx.vercel.app. You land on the Dashboard. Most cards will be empty or show zero — that is normal. A \"Complete Your Profile\" banner may appear at the top. The app is already working offline after this first load."
      },
      {
        "type": "callout",
        "text": "Install it first. On Android: Chrome menu → Add to Home Screen. On iPhone: Safari Share → Add to Home Screen. Desktop: click the install icon in the address bar. The PWA version is faster and works without a browser tab.",
        "variant": "tip"
      },
      {
        "type": "subhead",
        "text": "Setup Order — Do This in Sequence"
      },
      {
        "type": "text",
        "text": "Follow this order on Day 1. Each step feeds the next."
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Profile → tap the pencil icon → fill your name, student ID, department, year/term, enrolled year. Tap Save."
      },
      {
        "type": "step",
        "num": 2,
        "text": "Open Courses → your department's courses auto-load. Check that the correct courses are showing. Fix any statuses (Active, Backlog, etc.)."
      },
      {
        "type": "step",
        "num": 3,
        "text": "Open Schedule → select your time model (50-min or 40-min) → add your weekly class routine day by day."
      },
      {
        "type": "step",
        "num": 4,
        "text": "Open Teachers → add your subject teachers. This links them to courses and unlocks per-teacher tracking in Marks."
      },
      {
        "type": "step",
        "num": 5,
        "text": "Open Attendance → today's classes appear from your routine. Mark Present / Absent for each. Start doing this daily."
      },
      {
        "type": "step",
        "num": 6,
        "text": "Open Marks → enter CT marks as each CT happens. Enter hall marks after results publish."
      },
      {
        "type": "callout",
        "text": "Day 1 minimum: Steps 1–4 take about 15 minutes. After that, the app runs on autopilot — you just log attendance daily and add marks as they happen.",
        "variant": "success"
      },
      {
        "type": "subhead",
        "text": "Profile Setup Fields"
      },
      {
        "type": "table",
        "headers": [
          "Field",
          "What it does"
        ],
        "rows": [
          [
            "Name",
            "Your full name — shown on Dashboard and Profile page"
          ],
          [
            "Student ID",
            "Your KUET student ID (e.g., 2313014) — used for identification"
          ],
          [
            "Department",
            "Select from all 16 KUET departments — triggers auto-load of your courses and syllabus"
          ],
          [
            "Year & Term",
            "e.g., 2nd Year, 1st Term — loads the correct curriculum and schedule structure"
          ],
          [
            "CR Mode",
            "Tick if you are a Class Representative — unlocks CR Tools and CT Planner in navigation"
          ],
          [
            "Enrolled Year",
            "e.g., 2022 — used for batch calculations and CGPA timelines"
          ],
          [
            "Term Start Date",
            "Enables the Term Roadmap view on Dashboard (class-end, prep leave, exam dates)"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "App Navigation — Mobile vs Desktop"
      },
      {
        "type": "table",
        "headers": [
          "Layout Element",
          "What it does"
        ],
        "rows": [
          [
            "Bottom Nav (Mobile)",
            "4 core tabs + \"More\" button. Default: Dashboard, Attendance, Marks, Alerts + More."
          ],
          [
            "More Drawer (Mobile)",
            "Opens from the \"More\" button — shows all 33 pages grouped by category."
          ],
          [
            "Left Sidebar (Desktop)",
            "Always-visible collapsible panel with all pages grouped by category."
          ],
          [
            "Adaptive Nav",
            "After a few days of use, the bottom bar shifts to your 4 most-visited pages."
          ],
          [
            "Quick Access Page",
            "A single page showing your pinned pages, favorites, and recently used."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "Pages by Category — Quick Reference"
      },
      {
        "type": "table",
        "headers": [
          "Group",
          "Pages"
        ],
        "rows": [
          [
            "Overview",
            "Dashboard, Quick Access, Profile, Notes"
          ],
          [
            "Academics",
            "Courses, Attendance, Schedule, Assignments, Marks, Results, Teachers, Syllabus, Question Bank, Solution Bank"
          ],
          [
            "Daily Life",
            "Class Diary, Self Study, Time Tracker, Namaz Tracker"
          ],
          [
            "Wellbeing",
            "Self Evaluation, Smart Score"
          ],
          [
            "Finance",
            "Money, Tuition, Food & Health"
          ],
          [
            "Activities",
            "Clubs, Projects, Tours, Social"
          ],
          [
            "Tools",
            "Alerts, Reports, Settings, About KUETx"
          ],
          [
            "CR Only",
            "Routine, Class Planner, CT & Quiz Planner, Roster, Class Announcements, My Role (visible only when CR Mode is on)"
          ]
        ]
      }
    ]
  },
  {
    "num": "02",
    "id": "dashboard",
    "title": "Dashboard",
    "route": "/",
    "icon": "Grid",
    "category": "Overview",
    "desc": "Your home screen. Shows a live summary of your entire academic status at a glance. Everything…",
    "blocks": [
      {
        "type": "text",
        "text": "Your home screen. Shows a live summary of your entire academic status at a glance. Everything updates automatically as you enter data in other pages."
      },
      {
        "type": "subhead",
        "text": "What You'll See — Each Card Explained"
      },
      {
        "type": "table",
        "headers": [
          "Card",
          "What it shows"
        ],
        "rows": [
          [
            "CGPA Card",
            "Your live CGPA (from Results page). Color: Green ≥33.50, Yellow 2.20–3.49, Red below 2.20. Tap to go to Results."
          ],
          [
            "Attendance Status",
            "Average attendance across all Active courses. Green ≥75%, Yellow 60–74%, Red below 60%."
          ],
          [
            "Marks Overview",
            "Provisional GPA for the current term based on CT marks entered in Term Planner."
          ],
          [
            "Smart Score Ring",
            "Your composite personal score (0–100) combining academics, attendance, habits, and wellbeing."
          ],
          [
            "Alerts Strip",
            "Critical warnings at the top — red = must act now. Shows exam bar risk, CGPA risk, violations."
          ],
          [
            "Upcoming Deadlines",
            "Next 3 upcoming assignment deadlines from the Assignments page."
          ],
          [
            "Expense Summary",
            "Current month's total spending from the Money page."
          ],
          [
            "CGPA Trend Chart",
            "Area graph of term-by-term GPA history. Builds up over time as you enter results."
          ],
          [
            "Term Roadmap",
            "Timeline bar showing where you are in the current term. Requires Term Start Date in Profile."
          ],
          [
            "Focus Time Today",
            "Total productive hours (Study + Class + Self Study) from Time Tracker for today."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open the app — Dashboard loads by default at kuetx.vercel.app"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap any stat card to navigate directly to that section for more detail or to enter data"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Watch the alerts strip — if it's red, tap it and fix the issue immediately"
      },
      {
        "type": "step",
        "num": 4,
        "text": "CGPA trend chart will grow over 4 years as you enter each term's results"
      },
      {
        "type": "callout",
        "text": "Dashboard is read-only — it pulls data from all other pages. To see numbers here, enter data in Attendance, Marks, Results, and Money. Nothing on Dashboard requires direct input.",
        "variant": "info"
      }
    ]
  },
  {
    "num": "03",
    "id": "profile",
    "title": "Profile",
    "route": "/profile",
    "icon": "User",
    "category": "Overview",
    "desc": "Your full student profile dashboard — shows a live overview of all academic metrics. Also manages…",
    "blocks": [
      {
        "type": "text",
        "text": "Your full student profile dashboard — shows a live overview of all academic metrics. Also manages your Google account and Firebase real-time sync."
      },
      {
        "type": "subhead",
        "text": "What You'll See"
      },
      {
        "type": "bullet",
        "text": "Your photo, name, department, year/term, batch, and student ID",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Live academic summary: CGPA, earned credits, overall attendance percentage",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Term-wise GPA history table — one row per completed term",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Academic status: Normal / Probation / Dean's List / Honors Eligible",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Account section: Guest mode or logged-in Google account",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Tap the pencil / edit icon to open Profile Setup and update your details"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Upload a profile photo — stored in Firebase Storage, syncs across devices"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Tap \"Sign In with Google\" to enable Firebase real-time sync"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Guest mode users see a prompt — sync is optional, the app works fully without it"
      },
      {
        "type": "callout",
        "text": "Tip: Tap any metric card on the Profile page to jump directly to that section. Tap CGPA card → goes to Results. Tap Attendance card → goes to Attendance.",
        "variant": "tip"
      }
    ]
  },
  {
    "num": "04",
    "id": "courses",
    "title": "Courses",
    "route": "/courses",
    "icon": "BookOpen",
    "category": "Academics",
    "desc": "Your course list — the foundation everything else builds on. Courses for your department and…",
    "blocks": [
      {
        "type": "text",
        "text": "Your course list — the foundation everything else builds on. Courses for your department and year/term are auto-loaded from the built-in KUET curriculum database. You don't enter them manually."
      },
      {
        "type": "subhead",
        "text": "What You'll See"
      },
      {
        "type": "bullet",
        "text": "All courses auto-loaded for your department and year/term (set in Profile)",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Course code, name, credit hours, and type (Theory / Sessional / Project / Non-Credit)",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Status chip per course: Active, Completed, Backlog, Withdrawal, Incomplete",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Teacher chip — shows assigned teacher (linked from Schedule or Teachers page)",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Optional course selector if your department has elective slots",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "Course Status Types"
      },
      {
        "type": "table",
        "headers": [
          "Status",
          "What it means"
        ],
        "rows": [
          [
            "Active",
            "Currently attending — counted in attendance percentages, marks calculation, and CGPA"
          ],
          [
            "Completed",
            "Term finished — grade locked in Results. No longer affects attendance tracking."
          ],
          [
            "Backlog",
            "Failed and retaking — KUET Art. 16: maximum grade capped at B+ (3.25)"
          ],
          [
            "Withdrawal",
            "Officially withdrawn — not counted in GPA. Check KUET regulation for withdrawal rules."
          ],
          [
            "Incomplete",
            "Incomplete term — special status as per KUET academic regulations"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Courses — your term's courses are already listed (auto-loaded from your profile)"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap a course card to expand it and see full details"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Tap the status chip to change status: Active → Completed, Backlog, Withdrawal, etc."
      },
      {
        "type": "step",
        "num": 4,
        "text": "Tap \"+ Add Custom Course\" if a course is missing from the auto-loaded list"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Change year/term in Profile to switch which curriculum loads"
      },
      {
        "type": "callout",
        "text": "Warning: Course statuses affect CGPA calculation everywhere. Set them accurately. A Backlog course that should be Completed — or vice versa — will give a wrong CGPA reading.",
        "variant": "warning"
      }
    ]
  },
  {
    "num": "05",
    "id": "attendance",
    "title": "Attendance",
    "route": "/attendance",
    "icon": "CalendarCheck",
    "category": "Academics",
    "desc": "Per-course daily attendance tracker with shortage alerts, per-teacher tracking, KUET rule…",
    "blocks": [
      {
        "type": "text",
        "text": "Per-course daily attendance tracker with shortage alerts, per-teacher tracking, KUET rule enforcement, and automatic marks slab calculation. The most critical feature for staying exam-eligible."
      },
      {
        "type": "subhead",
        "text": "Attendance Marks Slab (KUET Formula)"
      },
      {
        "type": "table",
        "headers": [
          "Attendance %",
          "Marks Earned"
        ],
        "rows": [
          [
            "≥90%",
            "15 marks/teacher  |  30 marks total (2 teachers)"
          ],
          [
            "85–89%",
            "13.5 marks/teacher  |  27 marks total"
          ],
          [
            "80–84%",
            "12 marks/teacher  |  24 marks total"
          ],
          [
            "75–79%",
            "10.5 marks/teacher  |  21 marks total"
          ],
          [
            "70–74%",
            "9 marks/teacher  |  18 marks total"
          ],
          [
            "65–69%",
            "7.5 marks/teacher  |  15 marks total"
          ],
          [
            "60–64%",
            "6 marks/teacher  |  12 marks total"
          ],
          [
            "< 60%",
            "0 marks — and BARRED from exam (Art. 11.3)"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "Attendance Status Types"
      },
      {
        "type": "table",
        "headers": [
          "Status",
          "How it counts"
        ],
        "rows": [
          [
            "Present (P)",
            "Full attendance credit for this class"
          ],
          [
            "Absent (A)",
            "Absence counted — reduces your percentage"
          ],
          [
            "Late (L)",
            "Counted as half-present — configurable in settings"
          ],
          [
            "Medical (M)",
            "Medical leave — counted as absent but flagged separately for records"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Attendance — today's date is auto-selected"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Today's scheduled courses appear at the top based on your routine in Schedule"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Tap Present / Absent / Late / Medical for each course"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Use the calendar arrows to navigate to past dates and fill gaps"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Assign teachers to courses — enables per-teacher slab calculation"
      },
      {
        "type": "step",
        "num": 6,
        "text": "Mark holiday dates — they are excluded from attendance counts"
      },
      {
        "type": "callout",
        "text": "CRITICAL: Art. 11.3 — Below 60% = barred from exam. Art. 14.2 — Below 75% = scholarship loss. Lab/Sessional courses are marked as full attendance automatically (100%). Check your percentages weekly, not the day before exams.",
        "variant": "danger"
      }
    ]
  },
  {
    "num": "06",
    "id": "schedule",
    "title": "Class Schedule",
    "route": "/schedule",
    "icon": "Clock",
    "category": "Academics",
    "desc": "Your class routine — a visual weekly timetable (Sunday to Thursday) using KUET's official time…",
    "blocks": [
      {
        "type": "text",
        "text": "Your class routine — a visual weekly timetable (Sunday to Thursday) using KUET's official time models. Your routine feeds into Attendance (today's classes auto-appear) and Dashboard (today's class timeline)."
      },
      {
        "type": "subhead",
        "text": "Available Time Models"
      },
      {
        "type": "table",
        "headers": [
          "Model",
          "Details"
        ],
        "rows": [
          [
            "50 Minute Model",
            "8:00 AM start. Periods: 8:00, 8:50, 9:40, 10:30, 11:20, 12:10. Lunch gap 1:10–2:30 PM. Lab block: 2:30–5:00 PM."
          ],
          [
            "40 Minute Model",
            "9:00 AM start. Shorter class cycle. Lab block: 2:00–5:00 PM."
          ],
          [
            "Custom",
            "Define your own time slots if your department uses a different schedule structure."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Schedule and select your time model (50-min or 40-min)"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap \"+ Add\" on any day to open the slot editor"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Select the course, time period, room number, and teacher"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Repeat for your full weekly routine (typically takes 10–15 minutes once)"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Use the holiday marker for Eid, semester break, and other off days"
      },
      {
        "type": "callout",
        "text": "Set your routine once at the start of term — Attendance will then auto-suggest today's courses every morning, and the Dashboard will show today's class timeline without any extra input.",
        "variant": "tip"
      }
    ]
  },
  {
    "num": "07",
    "id": "assignments",
    "title": "Assignments",
    "route": "/assignments",
    "icon": "FileText",
    "category": "Academics",
    "desc": "Assignment and submission deadline tracker across all courses. Overdue assignments are highlighted…",
    "blocks": [
      {
        "type": "text",
        "text": "Assignment and submission deadline tracker across all courses. Overdue assignments are highlighted in red. The Dashboard automatically shows your next 3 upcoming deadlines."
      },
      {
        "type": "subhead",
        "text": "Priority Levels"
      },
      {
        "type": "table",
        "headers": [
          "Priority",
          "What it means"
        ],
        "rows": [
          [
            "High",
            "Urgent or high-mark assignments — shown first in the list"
          ],
          [
            "Medium",
            "Standard assignments — default priority"
          ],
          [
            "Low",
            "Optional or low-mark items — shown at the bottom"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Tap \"+ Add\" to create a new assignment"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Select course, write the title and description, set due date"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Set priority: High / Medium / Low"
      },
      {
        "type": "step",
        "num": 4,
        "text": "When submitted, tap the checkmark to mark it as Done"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Use the filter tabs to view: All / Pending / Done / Overdue"
      },
      {
        "type": "callout",
        "text": "The Alerts page watches your assignments and fires warnings for overdue or due-today items. Dashboard shows next 3 deadlines automatically — no extra setup needed.",
        "variant": "info"
      }
    ]
  },
  {
    "num": "08",
    "id": "syllabus",
    "title": "Syllabus",
    "route": "/syllabus",
    "icon": "List",
    "category": "Academics",
    "desc": "Your department's official KUET syllabus — course by course, topic by topic. Auto-loaded from your…",
    "blocks": [
      {
        "type": "text",
        "text": "Your department's official KUET syllabus — course by course, topic by topic. Auto-loaded from your profile. Useful for planning study sessions, knowing what to cover, and creating Self Study entries quickly."
      },
      {
        "type": "subhead",
        "text": "What You'll See"
      },
      {
        "type": "bullet",
        "text": "All courses for your department, organized by year and term",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Each course: code, name, credit hours, and contact hours per week",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Full chapter/topic list for each course in the proper order",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Marks breakdown per course (theory, sessional, or project)",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Syllabus — your department's curriculum loads automatically"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Use the year/term filter to browse other terms"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Tap a course to expand it and see the full topic list"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Tap any topic to instantly open a Self Study session pre-filled with that course and topic"
      },
      {
        "type": "callout",
        "text": "Power shortcut: Instead of typing course names manually in Self Study, always use Syllabus → tap topic → Self Study opens pre-filled. Saves time and keeps data consistent.",
        "variant": "tip"
      }
    ]
  },
  {
    "num": "09",
    "id": "question-bank",
    "title": "Question Bank",
    "route": "/question-bank",
    "icon": "BookMarked",
    "category": "Academics",
    "desc": "KUET past exam papers — all 16 departments, organized by year, term, and exam type. Your department…",
    "blocks": [
      {
        "type": "text",
        "text": "KUET past exam papers — all 16 departments, organized by year, term, and exam type. Your department is pre-selected from your profile. Papers are downloadable as PDF directly in the app."
      },
      {
        "type": "subhead",
        "text": "What You'll See"
      },
      {
        "type": "bullet",
        "text": "Papers organized by: Department → Year → Term",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Each paper: year, exam type (Regular / Backlog / Special), upload status",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Green checkmark = PDF available for immediate download",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Grey clock icon = paper not yet uploaded (you can contribute yours!)",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "What You Can Do"
      },
      {
        "type": "bullet",
        "text": "Filter by department, year, and term using dropdown filters",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Download any available paper as PDF with one tap",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Contribute a paper you have via the Google Form contribution link",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Switch to Solution Bank (/solutions) for step-by-step worked solutions",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Question Bank — your department is pre-selected automatically"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap any year to expand and see available papers"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Tap \"Download\" on any green-checked paper — PDF opens directly"
      },
      {
        "type": "step",
        "num": 4,
        "text": "For missing papers, tap \"Contribute\" to submit via Google Form"
      },
      {
        "type": "callout",
        "text": "Papers are added as students contribute. If you have a paper not listed, use the Contribute button. It takes under 1 minute and helps every KUETian in your department.",
        "variant": "info"
      }
    ]
  },
  {
    "num": "10",
    "id": "solutions",
    "title": "Solution Bank",
    "route": "/solutions",
    "icon": "BookOpen",
    "category": "Academics",
    "desc": "Step-by-step worked solutions to KUET past exam questions, organized by department, year, term, and…",
    "blocks": [
      {
        "type": "text",
        "text": "Step-by-step worked solutions to KUET past exam questions, organized by department, year, term, and course. Access detailed solutions instantly — understand the approach, not just the answer."
      },
      {
        "type": "subhead",
        "text": "What You'll See"
      },
      {
        "type": "bullet",
        "text": "Solutions organized by: Department → Year → Term → Course → Exam Year",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Each question: full problem statement, step-by-step solution, final answer",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Multiple solution years per course where available",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Department filter pre-set from your profile (change any time)",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Solution availability indicator per course — see which papers are solved at a glance",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How Solutions Are Organized"
      },
      {
        "type": "table",
        "headers": [
          "Level",
          "What it shows"
        ],
        "rows": [
          [
            "Department",
            "Select from all 16 KUET departments. Your dept is pre-selected from Profile."
          ],
          [
            "Year & Term",
            "e.g., Year 2, Term 1 — matches your curriculum structure"
          ],
          [
            "Course",
            "Course code + name (e.g., CSE2113 — Data Structures)"
          ],
          [
            "Exam Year",
            "The actual year the exam was held (e.g., 2021, 2022, 2023)"
          ],
          [
            "Questions",
            "Each question is a separate card with full problem + worked solution"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Solution Bank — your department auto-loads from Profile"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Select a Year and Term from the dropdown filters"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Tap a course to see available solved exam years"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Tap an exam year to expand all solved questions for that paper"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Read through each question’s step-by-step solution at your own pace"
      },
      {
        "type": "step",
        "num": 6,
        "text": "Use alongside Question Bank — view the original paper there, solutions here"
      },
      {
        "type": "subhead",
        "text": "Coverage Note"
      },
      {
        "type": "text",
        "text": "Solution Bank currently covers ESE (Energy Science & Engineering) department in detail, with more departments being added as students contribute solutions. Check the availability indicator for your department before exam season."
      },
      {
        "type": "callout",
        "text": "Best workflow before exams: (1) Download the question paper from Question Bank, (2) attempt it yourself first, (3) then open Solution Bank to check your approach against the step-by-step solution. This is significantly more effective than reading solutions cold.",
        "variant": "tip"
      }
    ]
  },
  {
    "num": "11",
    "id": "marks",
    "title": "Term Planner (Marks)",
    "route": "/marks",
    "icon": "ClipboardList",
    "category": "Academics",
    "desc": "Marks entry and grade prediction for all active courses. Follows KUET's official formula: 40%…",
    "blocks": [
      {
        "type": "text",
        "text": "Marks entry and grade prediction for all active courses. Follows KUET's official formula: 40% continuous assessment (CT + attendance + assignment) + 60% hall exam = 300 total marks."
      },
      {
        "type": "subhead",
        "text": "KUET Marks Formula — Breakdown"
      },
      {
        "type": "table",
        "headers": [
          "Component",
          "Details"
        ],
        "rows": [
          [
            "Class Tests (CT)",
            "Up to 5 CTs per teacher. Best 3 are auto-selected by the app. Max 10 marks per CT = 30 marks per teacher."
          ],
          [
            "Attendance Marks",
            "Auto-pulled from Attendance page using the slab formula. Max 15 marks per teacher."
          ],
          [
            "Assignment Marks",
            "Entered manually as given. Typically 5–10 marks per teacher."
          ],
          [
            "Continuous Total",
            "Teacher 1 total + Teacher 2 total. Max 90 marks combined (40% of 300 total)."
          ],
          [
            "Hall Exam",
            "Written final exam. Max 210 marks (70 marks × 3 questions answered = 60% of total)."
          ],
          [
            "Grand Total",
            "Continuous (90) + Hall (210) = 300. Grade is calculated from your percentage."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Term Planner — active courses are listed as expandable cards"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Expand a course — you'll see CT fields for Teacher 1 and Teacher 2 separately"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Enter CT marks as you receive them (up to CT5 for each teacher)"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Attendance marks auto-fill from the Attendance page — switch to Manual if needed"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Set a Target Grade (e.g., B+) to see the minimum hall mark required"
      },
      {
        "type": "step",
        "num": 6,
        "text": "After hall exam results, enter the final hall mark — your grade calculates live"
      },
      {
        "type": "callout",
        "text": "Tip: Use the Target Grade feature before every exam. If you need 140/210 hall marks for B+, you know your minimum. If you already have enough continuous marks, you might just need 100 in the hall exam.",
        "variant": "tip"
      }
    ]
  },
  {
    "num": "12",
    "id": "results",
    "title": "Results & GPA",
    "route": "/results",
    "icon": "TrendingUp",
    "category": "Academics",
    "desc": "Term-wise GPA/CGPA tracker and your complete academic history. Calculated using KUET's official…",
    "blocks": [
      {
        "type": "text",
        "text": "Term-wise GPA/CGPA tracker and your complete academic history. Calculated using KUET's official credit-weighted CGPA formula across all terms. Enter results once after each term publishes."
      },
      {
        "type": "subhead",
        "text": "KUET Grade Scale"
      },
      {
        "type": "table",
        "headers": [
          "Grade",
          "Points",
          "Percentage Range"
        ],
        "rows": [
          [
            "A+",
            "4.00",
            "80% and above"
          ],
          [
            "A",
            "3.75",
            "75 – 79%"
          ],
          [
            "A-",
            "3.50",
            "70 – 74%"
          ],
          [
            "B+",
            "3.25",
            "65 – 69%"
          ],
          [
            "B",
            "3.00",
            "60 – 64%"
          ],
          [
            "B-",
            "2.75",
            "55 – 59%"
          ],
          [
            "C+",
            "2.50",
            "50 – 54%"
          ],
          [
            "C",
            "2.25",
            "45 – 49%"
          ],
          [
            "D",
            "2.00",
            "40 – 44%"
          ],
          [
            "F",
            "0.00",
            "Below 40% — course must be retaken"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "Academic Status Thresholds"
      },
      {
        "type": "table",
        "headers": [
          "Status",
          "Condition"
        ],
        "rows": [
          [
            "Dean's List",
            "GPA ≥3.75 this term. Must have no F or Backlog courses in the term."
          ],
          [
            "Honors Eligible",
            "CGPA ≥3.50 across all completed terms with no backlogs (Art. 18.1)."
          ],
          [
            "Normal",
            "CGPA ≥2.20 — no academic risk."
          ],
          [
            "Academic Probation",
            "CGPA drops below 2.20 (Art. 20) — monitored status. App shows a warning."
          ],
          [
            "Struck-Off Risk",
            "Less than 36 credits earned in first 4 terms — App fires a critical alert."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "After each term's result publishes, open Results page"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap the relevant term (e.g., Y1T1) and enter your GPA or individual course grades"
      },
      {
        "type": "step",
        "num": 3,
        "text": "CGPA updates instantly and propagates across the entire app (Dashboard, Profile, Alerts)"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Check \"Dean's List eligible\" status each term — requires GPA ≥3.75 with no backlogs"
      },
      {
        "type": "callout",
        "text": "Academic Probation (Art. 20): CGPA < 2.20. Struck-Off: < 36 credits in first 4 terms. Backlog grades capped at B+ (Art. 16). The Alerts page monitors all of these rules automatically so you never miss a violation.",
        "variant": "danger"
      }
    ]
  },
  {
    "num": "13",
    "id": "teachers",
    "title": "Teachers",
    "route": "/teachers",
    "icon": "Users",
    "category": "Academics",
    "desc": "Your personal teacher directory. Add and link teachers to courses, schedule entries, and marks.…",
    "blocks": [
      {
        "type": "text",
        "text": "Your personal teacher directory. Add and link teachers to courses, schedule entries, and marks. Once linked, the same teacher name flows through Marks (per-teacher CT entry), Attendance (per-teacher slab), and Schedule — all from one source."
      },
      {
        "type": "subhead",
        "text": "Teacher Fields"
      },
      {
        "type": "table",
        "headers": [
          "Field",
          "Description"
        ],
        "rows": [
          [
            "Name",
            "Full name (the app auto-appends \"Sir\" if not already present)"
          ],
          [
            "Initial",
            "Short code used in schedule slot display (e.g., \"MSR\" for M.S. Rahman)"
          ],
          [
            "Title",
            "Designation: Lecturer, Asst. Prof., Assoc. Prof., Prof., Dr., etc."
          ],
          [
            "Department",
            "Home department of the teacher"
          ],
          [
            "Phone",
            "Mobile number for quick reference — stored locally, private to you"
          ],
          [
            "Email",
            "Office or KUET email address for contact"
          ],
          [
            "Office Room",
            "Room number for visiting during office hours"
          ],
          [
            "Rating",
            "Personal 1–5 star rating — fully private, only you can see it"
          ],
          [
            "Notes",
            "Any personal notes: office hour schedule, exam preferences, etc."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Tap \"+ Add Teacher\" and fill in at minimum: Name and Initial"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Open Schedule — teachers you added appear as suggestions when filling time slots"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Assign teachers to courses via the Courses page or Schedule page"
      },
      {
        "type": "step",
        "num": 4,
        "text": "In Term Planner (Marks), each linked teacher gets their own CT entry section"
      },
      {
        "type": "step",
        "num": 5,
        "text": "In Attendance, per-teacher tracking uses the same teacher you assigned in Schedule"
      },
      {
        "type": "callout",
        "text": "Consistency tip: Use the same teacher name everywhere. If you type \"A. Rahman\" in Schedule but \"Abdul Rahman\" in Teachers, the app may not link them. Add the teacher first, then pick from the suggestion dropdown.",
        "variant": "tip"
      }
    ]
  },
  {
    "num": "14",
    "id": "diary",
    "title": "Class Diary",
    "route": "/diary",
    "icon": "BookOpen",
    "category": "Daily Life",
    "desc": "A daily academic class log — write what was covered in each class, topics discussed, homework…",
    "blocks": [
      {
        "type": "text",
        "text": "A daily academic class log — write what was covered in each class, topics discussed, homework given, and any personal notes. Today's courses auto-appear from your routine so you don't have to select them manually."
      },
      {
        "type": "subhead",
        "text": "What You Can Do"
      },
      {
        "type": "bullet",
        "text": "Write per-course diary entries for any date (today or past dates)",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Add topics covered — select from your Syllabus topics or write custom text",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Note homework given, lab reports due, or teacher comments from that class",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Rate each class session 1–5 stars (your personal quality assessment)",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Mark a class as \"missed\" — links to attendance record for that date",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Navigate left/right by date to review or fill previous days",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Diary — today's date is pre-selected automatically"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Today's scheduled courses appear from your routine — expand the ones you attended"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Type what was covered in class, any homework, or personal notes"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Tap the star rating to rate the class 1–5 stars"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Navigate with arrows to review or add past entries"
      },
      {
        "type": "callout",
        "text": "Diary consistency (7 entries in 7 days = 100%) counts 4% toward Smart Score. Log even a one-line entry daily. Over a full term, you'll have a complete record of everything covered in class.",
        "variant": "info"
      }
    ]
  },
  {
    "num": "15",
    "id": "self-study",
    "title": "Self Study",
    "route": "/self-study",
    "icon": "Activity",
    "category": "Daily Life",
    "desc": "Study session tracker — log how long you study per course and visualize your study balance across…",
    "blocks": [
      {
        "type": "text",
        "text": "Study session tracker — log how long you study per course and visualize your study balance across subjects. Shows exactly which courses you're neglecting. Separate tabs for Academic courses and Extra Reading."
      },
      {
        "type": "subhead",
        "text": "Tabs"
      },
      {
        "type": "table",
        "headers": [
          "Tab",
          "What it tracks"
        ],
        "rows": [
          [
            "Academic",
            "Log study sessions linked to your actual courses and syllabus topics. Duration in hours."
          ],
          [
            "Extra Reading",
            "Track books, articles, YouTube courses, or online content outside the curriculum."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Tap \"+ Add Session\" (Academic tab) or \"+ Add Reading\" (Extra tab)"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Select course — your active courses appear as a dropdown"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Select the topic from the syllabus list (or type a custom topic)"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Enter duration in hours (e.g., 1.5 = 90 minutes, 0.5 = 30 minutes)"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Submit — bar chart updates immediately to show your balance"
      },
      {
        "type": "callout",
        "text": "Self Study 7-day total counts 6% toward Smart Score. Target: 14 hours/week. The bar chart makes it obvious which courses you're behind on — use it as a weekly planning tool.",
        "variant": "tip"
      }
    ]
  },
  {
    "num": "16",
    "id": "time",
    "title": "Time Tracker",
    "route": "/time",
    "icon": "Timer",
    "category": "Daily Life",
    "desc": "A live activity timer and daily time log. Track how you spend your 24 hours — study, class, sleep,…",
    "blocks": [
      {
        "type": "text",
        "text": "A live activity timer and daily time log. Track how you spend your 24 hours — study, class, sleep, social, everything. Includes a built-in Pomodoro/stopwatch timer that keeps running even when you navigate away."
      },
      {
        "type": "subhead",
        "text": "Timer Modes"
      },
      {
        "type": "table",
        "headers": [
          "Mode",
          "How it works"
        ],
        "rows": [
          [
            "Stopwatch",
            "Count up from 0:00. Tap Start when you begin, Stop when done. Duration auto-logged."
          ],
          [
            "Countdown",
            "Set a target duration (e.g., 25 min Pomodoro). Timer alerts when time is up."
          ],
          [
            "Manual Log",
            "No live timer needed — enter a past time block directly (start time + end time)."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "Activity Categories"
      },
      {
        "type": "table",
        "headers": [
          "Category",
          "Activities included"
        ],
        "rows": [
          [
            "Productive",
            "Study, Class, Self Study, Tuition, Library — counts toward Dashboard \"Focus Time\""
          ],
          [
            "Leisure",
            "Facebook/YouTube, Gaming, Adda/hangout, Entertainment, Travel"
          ],
          [
            "Health",
            "Sleep, Exercise, Rest, Namaz time"
          ],
          [
            "Other",
            "Any custom activity not in the above categories"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Select an activity category — optionally select a specific course if studying"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap Play to start the timer. It persists even if you switch to another page."
      },
      {
        "type": "step",
        "num": 3,
        "text": "Tap Stop — the session is auto-logged with duration and category"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Or tap \"+ Add\" to log a past block manually by typing start/end time"
      },
      {
        "type": "callout",
        "text": "Today's productive focus hours (Study + Class + Self Study) appear automatically on the Dashboard as \"Focus Time Today\". The timer keeps running even when you browse other pages.",
        "variant": "info"
      }
    ]
  },
  {
    "num": "17",
    "id": "namaz",
    "title": "Namaz Tracker",
    "route": "/namaz",
    "icon": "Moon",
    "category": "Daily Life",
    "desc": "Daily Salah (prayer) tracker. Mark each of the 5 daily prayers as done and optionally note whether…",
    "blocks": [
      {
        "type": "text",
        "text": "Daily Salah (prayer) tracker. Mark each of the 5 daily prayers as done and optionally note whether prayed in congregation at the masjid. 7-day consistency feeds into Smart Score (10% weight)."
      },
      {
        "type": "subhead",
        "text": "The 5 Daily Prayers — Default Times"
      },
      {
        "type": "table",
        "headers": [
          "Prayer",
          "Time"
        ],
        "rows": [
          [
            "Fajr",
            "Default: 5:10 AM — customizable in the Namaz settings gear"
          ],
          [
            "Dhuhr",
            "Default: 12:30 PM"
          ],
          [
            "Asr",
            "Default: 4:00 PM"
          ],
          [
            "Maghrib",
            "Default: 6:20 PM"
          ],
          [
            "Isha",
            "Default: 7:45 PM"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Namaz — today's date is pre-selected"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap each prayer card to mark it as done (✓)"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Tap the masjid icon on any prayer to also mark it as prayed in congregation"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Navigate to past dates to fill in missed tracking"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Tap the gear icon to set your local prayer times (saved permanently)"
      },
      {
        "type": "callout",
        "text": "Namaz 7-day average = 10% of Smart Score. Praying all 5 prayers consistently for 7 days = perfect 100/100 on this parameter. Miss 1 prayer = ~14 points penalty for that parameter.",
        "variant": "tip"
      }
    ]
  },
  {
    "num": "18",
    "id": "self-eval",
    "title": "Self Evaluation",
    "route": "/self-eval",
    "icon": "Heart",
    "category": "Wellbeing",
    "desc": "A private daily moral and habit tracker. Rate yourself, log good deeds and bad habits, and build…",
    "blocks": [
      {
        "type": "text",
        "text": "A private daily moral and habit tracker. Rate yourself, log good deeds and bad habits, and build self-awareness over time. Completely private — all data stays on your device. No server, no account required."
      },
      {
        "type": "subhead",
        "text": "What You Can Do"
      },
      {
        "type": "bullet",
        "text": "Log good deeds from presets or write a custom entry",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Log bad habits / mistakes to avoid — presets or custom",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Rate your overall day 1–5 stars with a label",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "View your 7-day rating trend as a bar chart",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Conduct Score = Good Deeds − Bad Habits × 1.5 (7-day rolling average)",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "Preset Entries"
      },
      {
        "type": "table",
        "headers": [
          "Type",
          "Available Presets"
        ],
        "rows": [
          [
            "Good Presets",
            "Helping someone, studying well, praying on time, exercising, reading books, doing good deeds"
          ],
          [
            "Bad Presets",
            "Lying, swearing, missing prayers, wasting time, hurting others"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Self Eval daily — ideally just before sleep as a reflection exercise"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap good deed preset chips or add custom entries for what you did well"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Tap bad habit chips or add custom entries for what to improve"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Drag the star slider to 1–5 and tap Save"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Conduct score (Good − Bad × 1.5) auto-calculates and feeds Smart Score"
      },
      {
        "type": "callout",
        "text": "Self Evaluation is 100% private. No data leaves your device. The Smart Score impact (8% conduct + 8% rating) rewards consistency, not perfection.",
        "variant": "success"
      }
    ]
  },
  {
    "num": "19",
    "id": "smart-score",
    "title": "Smart Score",
    "route": "/smart-score",
    "icon": "Star",
    "category": "Wellbeing",
    "desc": "Smart Score is your composite personal performance metric — academics, discipline, habits, and…",
    "blocks": [
      {
        "type": "text",
        "text": "Smart Score is your composite personal performance metric — academics, discipline, habits, and wellbeing combined into a single 0–100 score. It updates automatically as you use the app. Goal: keep all 9 parameters green."
      },
      {
        "type": "table",
        "headers": [
          "Parameter",
          "Weight",
          "How it calculates"
        ],
        "rows": [
          [
            "Academic (CGPA / Marks)",
            "30%",
            "CGPA out of 4.0 → score. CGPA 4.0 = 100 pts. Uses provisional marks if results not yet published."
          ],
          [
            "Attendance",
            "20%",
            "Average attendance across all active courses. 85%+ = 100, scales down proportionally below."
          ],
          [
            "Namaz (7-day average)",
            "10%",
            "Average daily prayers completed over last 7 days. 5/day consistently = 100 pts."
          ],
          [
            "Assignments Done",
            "10%",
            "% of all assignments marked complete. Finish everything on time for 100 pts."
          ],
          [
            "Self Rating (7-day avg)",
            "8%",
            "Daily 1–5 star self-ratings averaged over 7 days. 5.0 average = 100 pts."
          ],
          [
            "Conduct (7-day)",
            "8%",
            "Good deeds minus Bad habits ×1.5 over 7 days. Net positive = higher score."
          ],
          [
            "Self Study (7-day)",
            "6%",
            "14 hrs/week academic study = 100 pts. Every hour below 14 reduces the score."
          ],
          [
            "Diary (7-day)",
            "4%",
            "Days with diary entries in last 7 days. 7/7 days = 100 pts."
          ],
          [
            "Budget (30-day)",
            "4%",
            "Entry count consistency this month. More entries = shows financial discipline."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "Quick Wins to Boost Score"
      },
      {
        "type": "bullet",
        "text": "Log Namaz daily — 10% weight, very easy to maximize with consistent daily taps",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Fill Self Eval before sleep — adds 8% conduct + 8% self-rating for minimal time",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Log one diary entry per day — 4% weight from a 30-second task",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Enter CT marks as they happen — improves the Academic sub-score immediately",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Smart Score — see your total and each of the 9 parameter breakdowns"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap \"Show Details\" on any parameter to see exactly how that sub-score was calculated"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Red parameters = dragging your score down. Focus there first."
      },
      {
        "type": "step",
        "num": 4,
        "text": "Use the app daily across all features — the score naturally improves with consistent use"
      },
      {
        "type": "callout",
        "text": "Smart Score is never shared with anyone — not your teachers, not the university. It's your private compass. It rewards being a balanced student, not just academic performance.",
        "variant": "success"
      }
    ]
  },
  {
    "num": "20",
    "id": "money",
    "title": "Money (Finance)",
    "route": "/money",
    "icon": "Wallet",
    "category": "Finance",
    "desc": "Personal expense and income tracker built for campus life at KUET. Track what you spend, what you…",
    "blocks": [
      {
        "type": "text",
        "text": "Personal expense and income tracker built for campus life at KUET. Track what you spend, what you earn, see your running net balance, set a monthly budget, and view daily/monthly charts."
      },
      {
        "type": "subhead",
        "text": "Expense Categories"
      },
      {
        "type": "bullet",
        "text": "Meal/Food, Transport, Hall Fee, Course Fee, Personal, Junior Treat, Tour, Stationery, Other",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "Income Categories"
      },
      {
        "type": "bullet",
        "text": "Family, Tuition (tutoring income), Scholarship, Part-time, Freelance, Sell, Other",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "What You Can Do"
      },
      {
        "type": "bullet",
        "text": "Add income or expense entries: amount, category, date, optional note",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Set a starting Cash Balance — used to calculate your real running net balance",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Set a Monthly Budget — get a warning banner when spending exceeds 90%",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Navigate month-by-month using arrow buttons",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Filter by type (All / Income / Expense) and by category chips",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "See daily line chart showing income vs expense per day",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Export the month as a plain text memo (.txt) — readable in WhatsApp, Gmail, anywhere",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Tap the wallet icon or gear to set your starting Cash Balance and Monthly Budget"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap \"+ Add\" — choose Expense or Income via the toggle"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Fill in amount, tap a category chip, set date, add an optional note"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Check the daily line chart to spot unusual spending days"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Tap Export at month-end for a memo summary you can save or share"
      },
      {
        "type": "callout",
        "text": "Budget consistency (Money entries per month) counts 4% toward Smart Score. Even 2–3 entries per week keeps this parameter healthy. The budget warning fires at 90% — giving you a chance to course-correct.",
        "variant": "info"
      }
    ]
  },
  {
    "num": "21",
    "id": "alerts",
    "title": "Alerts",
    "route": "/alerts",
    "icon": "Bell",
    "category": "Tools",
    "desc": "Your academic guardian — automatic rule-based warnings calculated live from your data against…",
    "blocks": [
      {
        "type": "text",
        "text": "Your academic guardian — automatic rule-based warnings calculated live from your data against KUET's official academic regulations. No setup needed. Alerts appear the moment a threshold is crossed."
      },
      {
        "type": "subhead",
        "text": "Alert Severity Types"
      },
      {
        "type": "table",
        "headers": [
          "Type",
          "When to expect it"
        ],
        "rows": [
          [
            "🔴 CRITICAL",
            "Must act immediately. Cannot be dismissed. Stays until the issue is resolved."
          ],
          [
            "🟡 WARNING",
            "Potential issue developing. Can be dismissed after reading."
          ],
          [
            "🟢 POSITIVE",
            "Good news. Dean's List eligibility, Honors track, scholarship eligible."
          ],
          [
            "🔵 INFO",
            "Informational. Upcoming deadlines, data completeness reminders, sync status."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "What Alerts Check (KUET Regulations)"
      },
      {
        "type": "table",
        "headers": [
          "Alert Rule",
          "What it checks"
        ],
        "rows": [
          [
            "Exam bar risk",
            "Art. 11.3 — any course below 60% attendance. Critical. Must recover or appeal."
          ],
          [
            "Scholarship loss",
            "Art. 14.2 — any course below 75% attendance. Warning."
          ],
          [
            "Academic probation",
            "Art. 20 — CGPA drops below 2.20. Critical."
          ],
          [
            "Struck-off risk",
            "Less than 36 credits earned after first 4 terms. Critical."
          ],
          [
            "Honors eligible",
            "Art. 18.1 — CGPA ≥3.50 with no backlogs. Positive alert."
          ],
          [
            "Max B+ backlog cap",
            "Art. 16 — backlog course grade cannot exceed B+ (3.25). Info reminder."
          ],
          [
            "Assignment overdue",
            "Any assignment past its due date still marked as Pending."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Alerts — all current active warnings display automatically"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap any alert to jump directly to the relevant page to fix the issue"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Dismiss non-critical alerts after acknowledging them"
      },
      {
        "type": "step",
        "num": 4,
        "text": "CRITICAL alerts (red) cannot be dismissed — they stay until the underlying data changes"
      },
      {
        "type": "callout",
        "text": "Alerts also appear as a strip on the Dashboard. Check it every time you open the app. Aim for zero red badges at all times.",
        "variant": "warning"
      }
    ]
  },
  {
    "num": "22",
    "id": "notes",
    "title": "Notes",
    "route": "/notes",
    "icon": "FileText",
    "category": "Overview",
    "desc": "A free-form personal notepad. Create, edit, search, and pin titled notes — class reminders, quick…",
    "blocks": [
      {
        "type": "text",
        "text": "A free-form personal notepad. Create, edit, search, and pin titled notes — class reminders, quick thoughts, to-dos, teacher contact info, exam tips, anything you need to remember. All notes are stored offline on your device."
      },
      {
        "type": "subhead",
        "text": "Note Tags"
      },
      {
        "type": "table",
        "headers": [
          "Tag",
          "Use Case"
        ],
        "rows": [
          [
            "General",
            "Default tag — grey. For everyday notes without a specific category."
          ],
          [
            "Important",
            "High-priority notes — red. Use for things you must not forget."
          ],
          [
            "Idea",
            "Ideas and brainstorming — blue. For project ideas, app suggestions, plans."
          ],
          [
            "Todo",
            "Task reminders — yellow. For things you need to do but aren't in Assignments."
          ],
          [
            "Course",
            "Course-specific notes — green. Teacher tips, exam patterns, topics to focus on."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Tap \"+ New Note\" from the top right or the FAB button"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Type a title (short and descriptive) and write the note body"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Select a tag from the color chips"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Tap Save — note appears in the list immediately"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Tap the pin icon on any note to keep it pinned at the top"
      },
      {
        "type": "step",
        "num": 6,
        "text": "Use the search bar to filter notes by keyword instantly"
      },
      {
        "type": "callout",
        "text": "Great use case: Before each exam, create a \"Course\" tagged note per subject with key formulas, common Q&A from teachers, and exam tips. Search for the course name when revising.",
        "variant": "tip"
      }
    ]
  },
  {
    "num": "23",
    "id": "clubs",
    "title": "Clubs & Activities",
    "route": "/clubs",
    "icon": "Layers",
    "category": "Activities",
    "desc": "Track your club and society memberships and log your activities over time. A permanent record of…",
    "blocks": [
      {
        "type": "text",
        "text": "Track your club and society memberships and log your activities over time. A permanent record of your extracurricular involvement — useful for portfolios, CVs, and memories of your KUET years."
      },
      {
        "type": "subhead",
        "text": "What You Can Do"
      },
      {
        "type": "bullet",
        "text": "Add clubs and societies: name, your role (Member / Officer / Secretary / President), year joined",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Log activities per club: title, date, duration in hours, and a description of what happened",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "View all activities in a chronological timeline per club",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "See total hours invested per club across all activities",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Tap \"+ Add Club\" to register a club or society"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Enter the club name, your role, and the year you joined"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Tap the club to expand it, then tap \"+ Add Activity\""
      },
      {
        "type": "step",
        "num": 4,
        "text": "Fill in activity title, date, hours invested, and a brief description"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Repeat as you attend events, win competitions, or hold positions"
      },
      {
        "type": "callout",
        "text": "Clubs data is private and local. Consider logging even small activities — a programming contest, a workshop — for a complete extracurricular record useful for CVs and scholarship applications.",
        "variant": "info"
      }
    ]
  },
  {
    "num": "24",
    "id": "class-management",
    "title": "CR Tools",
    "route": "/class-rep",
    "icon": "Users",
    "category": "Class Rep",
    "desc": "A dedicated workspace for Class Representatives. Only visible when CR Mode is enabled in Profile.…",
    "blocks": [
      {
        "type": "text",
        "text": "A dedicated workspace for Class Representatives. Only visible when CR Mode is enabled in Profile. Helps CRs manage class routines, track class counts, and share updates with their batch. Each tool below is now its own page — open them from the Class Rep hub."
      },
      {
        "type": "subhead",
        "text": "Pages in the Class Rep hub"
      },
      {
        "type": "table",
        "headers": [
          "Page",
          "What it does"
        ],
        "rows": [
          [
            "Routine",
            "View the class schedule — which course is happening at which time slot, day by day"
          ],
          [
            "Class Planner",
            "Track how many classes have been held per course for the term, automatic or manual +1 logging"
          ],
          [
            "CT & Quiz Planner",
            "Schedule and track Class Tests and Quizzes — see the timeline and total count per course"
          ],
          [
            "Roster",
            "Manage class members, verify join requests, and assign roles"
          ],
          [
            "Class Announcements",
            "Send notices to the class and see reach/read stats"
          ],
          [
            "My Role",
            "See your CR/ACR status and step down or hand off the role"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Enable CR Mode in Profile first: Profile → Edit Profile → tick \"I am a CR\""
      },
      {
        "type": "step",
        "num": 2,
        "text": "Open the Class Rep hub from the navigation — it appears after CR Mode is enabled"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Routine: verify the class flow at a glance, day by day"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Class Planner: after each class, update the class count for that course"
      },
      {
        "type": "step",
        "num": 5,
        "text": "CT & Quiz Planner: schedule upcoming CTs/quizzes per course to keep the class informed"
      },
      {
        "type": "step",
        "num": 6,
        "text": "Routine: use WhatsApp/Export/Open Schedule to share the day's routine with your class group"
      },
      {
        "type": "callout",
        "text": "CR Mode must be enabled in Profile to unlock the Class Rep hub and its tools in the navigation. Toggle it in Profile → Edit Profile.",
        "variant": "warning"
      }
    ]
  },
  {
    "num": "25",
    "id": "ct-quiz-planning",
    "title": "CT & Quiz Planner",
    "route": "/ct-quiz-planning",
    "icon": "CalendarCheck",
    "category": "Class Rep",
    "desc": "A calendar-based exam event planner for CRs. Schedule Class Tests, quizzes, and assignment…",
    "blocks": [
      {
        "type": "text",
        "text": "A calendar-based exam event planner for CRs. Schedule Class Tests, quizzes, and assignment deadlines with smart conflict detection and weekly pressure analysis. (Requires CR Mode)"
      },
      {
        "type": "subhead",
        "text": "What You Can Do"
      },
      {
        "type": "bullet",
        "text": "Add CT / Quiz / Assignment events to specific dates on a monthly calendar view",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Smart Assist: detects conflicts when multiple exams are scheduled on the same day",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Weekly pressure analysis: automatically labels weeks as High / Medium / Low exam pressure",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Auto-suggest a more balanced distribution of CTs if overloaded weeks are detected",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Copy the month's full schedule as a formatted text to share with the class",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Navigate month-by-month to plan upcoming CTs in advance",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How to Use"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open CT & Quiz Planner (requires CR Mode enabled in Profile)"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap any date on the calendar to add an event"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Select course, event type (CT / Quiz / Assignment), and give it a title"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Smart Assist shows a conflict warning if other events already exist on that day"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Check the weekly pressure indicators before confirming the date"
      },
      {
        "type": "step",
        "num": 6,
        "text": "When the schedule is finalized, tap \"Copy\" to share it with your class group"
      }
    ]
  },
  {
    "num": "26",
    "id": "more-features",
    "title": "More Features",
    "route": null,
    "icon": "LayoutGrid",
    "category": "Activities",
    "desc": "These pages are accessible from the sidebar (desktop) or the \"More\" drawer (mobile). Each addresses…",
    "blocks": [
      {
        "type": "text",
        "text": "These pages are accessible from the sidebar (desktop) or the \"More\" drawer (mobile). Each addresses a specific campus life need. None of them affect your Smart Score if unused — they are optional extras."
      },
      {
        "type": "subhead",
        "text": "Tuition   (/tuition)"
      },
      {
        "type": "text",
        "text": "If you tutor other students for income, track your sessions here. Log student name, subject, date, session duration, agreed fee, and payment status. View monthly tuition income summary. Separate from the Money page income tracker — this gives more detail per student."
      },
      {
        "type": "subhead",
        "text": "Food & Health   (/food)"
      },
      {
        "type": "text",
        "text": "Log daily meals — breakfast, lunch, dinner — and rate hall food quality. Track eating habits over time, identify days you skipped meals, and monitor nutritional categories. Useful for students managing health alongside academics."
      },
      {
        "type": "subhead",
        "text": "Projects   (/projects)"
      },
      {
        "type": "text",
        "text": "Track academic project progress: project title, course link, team members, supervisor name, deadline, current status (Not Started / In Progress / Submitted / Completed), and milestone notes. Good for project-based or design courses where deadlines span multiple weeks."
      },
      {
        "type": "subhead",
        "text": "Tours   (/tours)"
      },
      {
        "type": "text",
        "text": "Record batch tours and trips. Log participants, total budget, actual amount spent, destinations, and a brief itinerary. Rate the experience. Over 4 years, this becomes a memory log of every batch tour you joined."
      },
      {
        "type": "subhead",
        "text": "Social Time   (/social)"
      },
      {
        "type": "text",
        "text": "Log social activities — batch hangouts, events, celebrations, gatherings. Combined with Time Tracker data, you can see your actual study/social balance over time."
      },
      {
        "type": "subhead",
        "text": "Reports   (/reports)"
      },
      {
        "type": "text",
        "text": "Generate a formatted printable academic report combining attendance, marks, and CGPA in one view. Useful if you need to show your academic standing to someone or want a clean printed summary for yourself at the end of each term."
      },
      {
        "type": "text",
        "text": "Calculator tools are built directly into the Term Planner (/marks) and Results (/results) pages. In Term Planner, use the Target Grade feature to calculate the exact hall marks needed for any grade. In Results, view your Maximum Achievable CGPA projection based on remaining terms. There is no separate Calculators page."
      },
      {
        "type": "callout",
        "text": "All \"More\" pages are optional. Smart Score is not penalized if you skip Tours, Food, Social, etc. Use only what is relevant to your situation. They are there when you need them.",
        "variant": "info"
      }
    ]
  },
  {
    "num": "27",
    "id": "settings",
    "title": "Settings & Privacy",
    "route": "/settings",
    "icon": "Settings",
    "category": "Tools",
    "desc": "Data management, app preferences, backup and restore. All KUETx data lives on your device…",
    "blocks": [
      {
        "type": "text",
        "text": "Data management, app preferences, backup and restore. All KUETx data lives on your device (IndexedDB) — nothing is sent to any server unless you explicitly sign in with Google to enable Firebase sync."
      },
      {
        "type": "subhead",
        "text": "What You Can Do"
      },
      {
        "type": "bullet",
        "text": "Theme — Light / Dark / System (auto-follows device system theme)",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "App Mode — Full Student mode (33 pages) or Simplified mode (academics only)",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Export Data — download all your data as a .json backup file to your device",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Import Data — restore from a previously saved .json backup file",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Preview Backup — inspect a .json file before overwriting current data",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Auto-backup Reminder — toggleable notification to remind you to export weekly",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Storage Usage — shows how much IndexedDB space KUETx is currently using",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Clear All Data — full reset (you must type a confirmation phrase to proceed)",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "Data & Privacy"
      },
      {
        "type": "table",
        "headers": [
          "Topic",
          "Detail"
        ],
        "rows": [
          [
            "Storage location",
            "IndexedDB on your device. No KUETx server ever receives your data."
          ],
          [
            "Server data",
            "Nothing sent to any external server (except Firebase if you signed in)"
          ],
          [
            "Login required",
            "No. KUETx works fully offline without any account or login."
          ],
          [
            "Backup format",
            "Standard .json file — human-readable, portable, restoreable anytime"
          ],
          [
            "Data loss risk",
            "Clearing browser data = losing everything. Always export backups regularly."
          ],
          [
            "New device setup",
            "Export backup on old device → install on new device → import the .json file"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Backup & Restore"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Go to Settings → Backup & Restore section"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap \"Export\" → saves kuetx-backup-[date].json to your Downloads folder"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Store it safely: Google Drive, WhatsApp Saved Messages, email to yourself"
      },
      {
        "type": "step",
        "num": 4,
        "text": "To restore: tap \"Import\" → select your saved .json file"
      },
      {
        "type": "step",
        "num": 5,
        "text": "Use Preview to inspect the backup contents before committing to import"
      },
      {
        "type": "callout",
        "text": "NEVER skip backups. If you change phones, reinstall the browser, or your device gets reset WITHOUT a backup or sync active, your KUETx data is permanently lost. Export weekly minimum.",
        "variant": "danger"
      }
    ]
  },
  {
    "num": "28",
    "id": "firebase-sync",
    "title": "Firebase Sync",
    "route": "/profile",
    "icon": "CloudCog",
    "category": "Tools",
    "desc": "For real-time cross-device sync, KUETx supports Google Sign-In via Firebase. Data pushes to…",
    "blocks": [
      {
        "type": "text",
        "text": "For real-time cross-device sync, KUETx supports Google Sign-In via Firebase. Data pushes to Firestore within 1.5 seconds of any change and pulls changes from other devices in real-time via onSnapshot listeners."
      },
      {
        "type": "subhead",
        "text": "What Syncs via Firebase"
      },
      {
        "type": "bullet",
        "text": "All academic data: courses, marks, attendance, results, assignments, schedule",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Personal data: diary, self study sessions, namaz logs, self eval, money entries, notes",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Profile picture (stored in Firebase Storage)",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Does NOT sync: autoBackup preference, lastBackupTime (device-local settings)",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How to Sign In"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open Profile page"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap \"Sign In with Google\" or the Account banner at the top of Profile"
      },
      {
        "type": "step",
        "num": 3,
        "text": "Complete Google OAuth — data immediately syncs to Firestore"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Every subsequent change auto-syncs within 1.5 seconds"
      },
      {
        "type": "step",
        "num": 5,
        "text": "To log out: tap Logout from Profile. Local data stays on the device."
      },
      {
        "type": "callout",
        "text": "Guest mode = data stays on this device only, with no cloud backup. Google Sign-In = data syncs across all your devices in real-time. You can switch between modes anytime without losing local data.",
        "variant": "info"
      }
    ]
  },
  {
    "num": "30",
    "id": "quick-access",
    "title": "Quick Access & Nav",
    "route": "/quick-access",
    "icon": "Zap",
    "category": "Overview",
    "desc": "Quick Access is a personal page launcher and a map of every page in KUETx, grouped by…",
    "blocks": [
      {
        "type": "text",
        "text": "Quick Access is a personal page launcher — shows your pinned pages, favorited pages, and most-recently-used pages all in one place. The bottom navigation also adapts based on your usage patterns over time."
      },
      {
        "type": "subhead",
        "text": "Navigation Groups"
      },
      {
        "type": "table",
        "headers": [
          "Group",
          "Pages included"
        ],
        "rows": [
          [
            "Overview",
            "🟢 Dashboard, Quick Access, Profile, Notes"
          ],
          [
            "Class Rep",
            "🟟 Routine, Class Planner, CT & Quiz Planner, Roster, Class Announcements, My Role (visible only in CR Mode)"
          ],
          [
            "Academics",
            "🟦 Courses, Attendance, Schedule, Assignments, Marks, Results, Teachers, Syllabus, QB, Solution Bank"
          ],
          [
            "Daily Life",
            "🟡 Diary, Self Study, Time Tracker, Namaz"
          ],
          [
            "Wellbeing",
            "🧡 Self Eval, Smart Score"
          ],
          [
            "Finance",
            "🟢 Money, Tuition, Food & Health"
          ],
          [
            "Activities",
            "🟠 Clubs, Projects, Tours, Social"
          ],
          [
            "Tools",
            "⚫ Alerts, Reports, Settings, About KUETx"
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "Adaptive Bottom Navigation"
      },
      {
        "type": "bullet",
        "text": "Default tabs: Dashboard, Attendance, Marks, Alerts + More button",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "After regular use: bottom bar adapts to show your 4 most-frequently visited pages",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Manual override: long-press the bottom nav bar to pin or unpin specific pages",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Favorites: star any page from Quick Access — it appears in a permanent Favorites section",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "App Modes"
      },
      {
        "type": "table",
        "headers": [
          "Mode",
          "What shows"
        ],
        "rows": [
          [
            "Full Student Mode",
            "All 33 pages visible across all 8 navigation groups. Default mode."
          ],
          [
            "Simplified Mode",
            "Hides Activities, Wellbeing, Finance groups. Shows only core academics + Daily Life pages. Toggle in Settings."
          ]
        ]
      },
      {
        "type": "callout",
        "text": "First time using More drawer? Long-press any page icon to pin it to the bottom navigation for instant access without going through More every time.",
        "variant": "tip"
      }
    ]
  },
  {
    "num": "32",
    "id": "quick-tips",
    "title": "Quick Tips & Troubleshooting",
    "route": null,
    "icon": "HelpCircle",
    "category": "Tools",
    "desc": "KUETx — built by a KUETian, for KUETians.",
    "blocks": [
      {
        "type": "table",
        "headers": [
          "Problem / Question",
          "Solution"
        ],
        "rows": [
          [
            "First time setup?",
            "Do it in order: (1) Profile, (2) Courses, (3) Schedule, (4) Teachers, (5) Attendance, (6) Marks. Takes about 15 minutes total."
          ],
          [
            "Dashboard showing zeros?",
            "Enter data in Courses, Attendance, and Marks first. Dashboard is read-only — it displays what you've entered elsewhere."
          ],
          [
            "CGPA not updating?",
            "Enter results in the Results page (/results) after each term publishes. Dashboard pulls CGPA from there, not from Marks."
          ],
          [
            "Attendance percentage wrong?",
            "Check course statuses in Courses page. Only \"Active\" courses count toward attendance. Completed/Withdrawal courses are excluded."
          ],
          [
            "Missing a course?",
            "Tap \"+ Add Custom Course\" in Courses for anything not in the auto-loaded list."
          ],
          [
            "App running slow?",
            "Install as PWA (Add to Home Screen). PWA version is significantly faster than opening in a browser tab every time."
          ],
          [
            "Lost data after phone reset?",
            "Restore from your exported .json backup via Settings → Import. If you had Firebase Sync active, sign in again and data pulls automatically."
          ],
          [
            "ISP blocking the site?",
            "Some Bangladesh ISPs (e.g., Airtel) block *.vercel.app domains. Use a VPN or switch to mobile data. The PWA works offline after first load."
          ],
          [
            "Can't see CR tools?",
            "Enable CR Mode in Profile → Edit Profile → check \"I am a CR\". CR tools are hidden for non-CR students to keep navigation clean."
          ],
          [
            "Grade not calculating?",
            "Make sure CT marks are entered in Term Planner. Attendance marks need \"Auto\" mode active (or enter manually). Hall marks also needed for final grade."
          ],
          [
            "Smart Score very low?",
            "Quick wins: log Namaz daily (10%), rate yourself in Self Eval (8%), write one diary line (4%). These three alone are 22% of your total score."
          ],
          [
            "Schedule not showing in Attendance?",
            "Go to Schedule page and add your class routine. Today's classes only auto-appear in Attendance after the routine is filled in."
          ],
          [
            "Attendance marks showing 0?",
            "The attendance marks slab is per-teacher. Assign teachers to your courses first. Then the slab calculates separately per teacher (max 15 each, 30 total)."
          ],
          [
            "Can I use the app without internet?",
            "Yes — after first load, KUETx works fully offline. The PWA caches everything. Only Firebase sync needs internet."
          ],
          [
            "How to copy data to a new device?",
            "Method 1: Settings → Export → transfer .json → Import on new device. Method 2: Firebase Sync — just sign in on the new device and everything syncs automatically."
          ],
          [
            "Where is the Question Bank solution for my paper?",
            "Open Solution Bank (/solutions) from the Academics navigation group. Select your department, year, term, and course to see available worked solutions."
          ],
          [
            "Question Bank paper missing?",
            "Tap \"Contribute\" on any missing paper to submit your copy via Google Form. It takes under 2 minutes and helps every student in your department."
          ]
        ]
      },
      {
        "type": "text",
        "text": "KUETx — built by a KUETian, for KUETians."
      },
      {
        "type": "text",
        "text": "kuetx.vercel.app"
      }
    ]
  },
  {
    "num": "33",
    "id": "about",
    "title": "About KUETx",
    "route": "/about",
    "icon": "Info",
    "category": "Tools",
    "desc": "The About page is your gateway to understanding the app — who built it, what version you're…",
    "blocks": [
      {
        "type": "text",
        "text": "The About page is your gateway to understanding the app — who built it, what version you're running, how to read the guide, and how to give feedback or contribute. You can also open the full KUETx Guide right here, in a rich in-app view."
      },
      {
        "type": "subhead",
        "text": "What You'll See on the About Page"
      },
      {
        "type": "bullet",
        "text": "KUETx Guide — tap to open the full interactive guide without leaving the app",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "App version number and changelog — what's new in this release",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Feature overview — a visual summary of all major feature groups",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Developer credit — built by a KUETian, for KUETians",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Feedback / contribution links — report bugs, suggest features, contribute question papers",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Tech stack credits — React, Vite, Firebase, Tailwind, IndexedDB",
        "sub": false
      },
      {
        "type": "subhead",
        "text": "How to Access the Guide In-App"
      },
      {
        "type": "step",
        "num": 1,
        "text": "Open the About page from the sidebar or navigation (\"About KUETx\")"
      },
      {
        "type": "step",
        "num": 2,
        "text": "Tap the \"KUETx Guide\" banner at the top of the About page"
      },
      {
        "type": "step",
        "num": 3,
        "text": "The guide opens in a rich modal — read and jump between sections without leaving the app"
      },
      {
        "type": "step",
        "num": 4,
        "text": "Tap Close or the backdrop to dismiss and return to where you were"
      },
      {
        "type": "subhead",
        "text": "App Version & Updates"
      },
      {
        "type": "table",
        "headers": [
          "Topic",
          "Detail"
        ],
        "rows": [
          [
            "Version number",
            "Shown on the About page. Check this when reporting a bug so support can reproduce it accurately."
          ],
          [
            "PWA update",
            "When a new version of KUETx is available, the app shows a \"Update Available\" banner. Tap to reload and get the latest version."
          ],
          [
            "Auto-update",
            "PWA updates apply when you reopen the app after it's been in background. No manual install needed."
          ],
          [
            "Version history",
            "Changelog on the About page lists what changed in each release."
          ]
        ]
      },
      {
        "type": "subhead",
        "text": "How to Contribute"
      },
      {
        "type": "bullet",
        "text": "Question papers: tap \"Contribute\" from the Question Bank page — Google Form link, takes ~2 minutes",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Bug reports: use the feedback link on the About page to report issues with steps to reproduce",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Feature suggestions: submit via the feedback form with your use case and why it helps KUETians",
        "sub": false
      },
      {
        "type": "bullet",
        "text": "Solutions: contact via the feedback link to contribute step-by-step solutions to past papers",
        "sub": false
      },
      {
        "type": "callout",
        "text": "The KUETx Guide (which you are currently reading) is accessible any time from the navbar, footer, or About page — no internet required once the PWA is installed. Share kuetx.vercel.app with your batchmates so they can benefit too.",
        "variant": "success"
      },
      {
        "type": "text",
        "text": "KUETx — built by a KUETian, for KUETians."
      },
      {
        "type": "text",
        "text": "kuetx.vercel.app"
      }
    ]
  }
];
