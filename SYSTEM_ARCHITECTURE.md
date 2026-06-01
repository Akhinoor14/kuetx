# CT & Quiz Management System - Architecture & Integration

## 🎯 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CT & Quiz Management                      │
│                                                               │
│  Term/Dept Selection → Auto-Load Data → Smart Assists       │
│          ↓                    ↓               ↓              │
│    (Dropdown)        (holidays.json +     (spacing,         │
│                      curriculum.json)     teachers)         │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Schedule Generation (3 Models)                       │   │
│  │ • Balanced: Even spacing                             │   │
│  │ • Distributed: Max gaps                              │   │
│  │ • Teacher-Centric: Teacher availability windows      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ CR Customization Layer                               │   │
│  │ • Edit course CT counts                              │   │
│  │ • Adjust generated dates                             │   │
│  │ • Assign teacher names                               │   │
│  │ • Save per-term configurations                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Export & Persistence                                 │   │
│  │ • ICS (Google Calendar, Outlook, Apple Cal)         │   │
│  │ • JSON (for data integration)                        │   │
│  │ • localStorage (per-department, per-semester)       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 File Structure & Version Comparison

### **V1 (Original - Currently Active)**
```
src/pages/CTQuizManagement.jsx
├── Hardcoded sample data (CSE101, PHY201L)
├── Fixed term (T2026S1)
├── Basic model selector
├── Generate → Edit → Export flow
└── Works but not flexible
```

### **V2 (New - Smart Assists)**
```
src/pages/CTQuizManagementV2.jsx
├── Term/Department selector (dynamic)
├── Auto-loads courses from curriculum-terms-courses.json
├── Auto-loads holidays from holidays.json
├── Smart teacher configuration panel
├── Spacing suggestions based on actual term length
├── Full customization layer
└── Data-driven, reusable across pages
```

## 🔄 Data Flow Architecture

### **Master Data Sources**

```
┌─────────────────────────────────────────────────────┐
│  Curriculum Master Data                              │
│  (curriculum-terms-courses.json)                    │
│  ├── All departments                                │
│  ├── All semesters per department                   │
│  └── All courses per semester                       │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────┐
        ↓                     ↓          ↓
   ┌─────────┐         ┌──────────┐  ┌────────────┐
   │Schedule │         │CT Quiz   │  │Term Planner│
   │Page     │         │Mgmt      │  │            │
   └─────────┘         └──────────┘  └────────────┘
        ├                  ├              ├
        └──────────────────┴──────────────┘
                  ↓
        ┌──────────────────────┐
        │ Single Source Truth  │
        │ No duplication       │
        │ Easy to update       │
        └──────────────────────┘
```

### **Holiday Data Flow**

```
holidays.json
├── Year (2024, 2025, 2026, ...)
└── TermCode (T2026S1, T2026S2, ...)
    ├── holidays: ["2026-09-24", ...] ← Specific dates
    └── nonInstructionWeeks: [{start, end}, ...] ← Date ranges
                ↓
        CT Quiz Management loads for selected term
        ↓
        Excludes these dates from instruction day calculation
        ↓
        Schedules CTs only on instruction days
```

### **Teacher Data Flow**

```
┌─────────────────────────────────┐
│ Schedule Page Assignment        │
│ (User assigns teachers)         │
└────────────┬────────────────────┘
             ↓
   localStorage.setItem('course_teachers', {...})
             ↓
┌────────────────────────────────┐
│ CT Quiz Mgmt (V2)              │
│ Reads: getTeachersForCourse()  │
├────────────────────────────────┤
│ If found → Shows real names    │
│ If not → Shows "Teacher 1,2..." │
└────────────────────────────────┘
             ↓
   CR can edit teacher names here too
   ↓
   Changes save back to localStorage
```

## 🚀 Integration Steps (Switching to V2)

### **Step 1: Update App.jsx Route**

```javascript
// OLD (Comment out or remove)
// import CTQuizManagement from './pages/CTQuizManagement';
// <Route path="/ct-quiz-management" element={<CTQuizManagement />} />

// NEW
import CTQuizManagementV2 from './pages/CTQuizManagementV2';
<Route path="/ct-quiz-management" element={<CTQuizManagementV2 />} />
```

### **Step 2: Add CSS Import in CTQuizManagementV2.jsx**

The component already has:
```javascript
import '../styles/CTQuizManagementV2.css';
```

Make sure this file exists: `src/styles/CTQuizManagementV2.css` ✓

### **Step 3: Verify Data Files**

Ensure these exist:
- ✓ `src/data/curriculum-terms-courses.json` 
- ✓ `src/data/holidays.json`

### **Step 4: Test in Browser**

Navigate to `http://localhost:5174/ct-quiz-management`

Expected:
1. Department dropdown shows all departments from curriculum data
2. Semester selector shows all semesters for selected dept
3. Courses auto-load for selected term
4. Holidays auto-load for selected term
5. Spacing suggestions appear

---

## 📊 Smart Assists Breakdown

### **1. Automatic Holidays Loading**

```javascript
// In CTQuizManagementV2.jsx useEffect
const year = currentTermData.termCode.match(/T(\d{4})/)[1];
const termHols = holidaysData[year][currentTermData.termCode];
// Auto-loads holidays specific to this term
```

**Benefit**: No manual holiday entry per CR. Holidays are centralized and applied consistently.

### **2. Automatic Courses Loading**

```javascript
const courses = curriculumData.departments[department]
  ?.semesters[semesterKey]?.courses;
// Gets exact course list for term
```

**Benefit**: CR sees exactly what courses are in their curriculum. No guessing or manual entry.

### **3. Spacing Intelligence**

```javascript
const instructionDays = calculateInstructionDays(
  startDate, endDate, holidays
);
const spacingSuggestions = {
  totalInstructionDays: instructionDays.length,
  suggestedMinGap: Math.ceil(instructionDays.length / 12)
};
```

**Benefit**: Spacing suggestions are intelligent (based on actual term length, not hard-coded 12 days).

### **4. Teacher Name Auto-Update**

```javascript
// Check if teachers are assigned elsewhere
const courseTeachers = getTeachersForCourse(courseId) 
  || ['Teacher 1', 'Teacher 2']; // Fallback to defaults
```

**Benefit**: 
- Works immediately with defaults
- Auto-updates when teachers assigned in Schedule page
- No cross-page data duplication

### **5. Configuration Panel (Editable)**

```javascript
<div className="teacher-config-panel">
  {/* CR can assign/reassign any teacher */}
  <input
    onChange={e => {
      setTeachers({ ...teachers, [courseId]: [newTeachers] });
    }}
  />
</div>
```

**Benefit**: Full control for CR. System suggests, but CR can customize.

---

## 🔗 Reuse Pattern for Other Pages

### **Schedule Page Example**

```javascript
import curriculumData from '../data/curriculum-terms-courses.json';

function SchedulePage() {
  const courses = curriculumData
    .departments[userDept]
    ?.semesters[userSem]
    ?.courses; // Auto-get courses
  
  // Render courses in schedule grid
  // Same list as CT Quiz Mgmt uses
}
```

### **Term Planner Example**

```javascript
function TermPlanner() {
  const courses = curriculumData[...]?.courses;
  
  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
  const totalCTs = courses.reduce((sum, c) => sum + c.ctCount, 0);
  
  // Show workload calculation
}
```

### **Class Management Example**

```javascript
function ClassManagement() {
  const termData = curriculumData[...]?.semesters[...];
  
  // Show term info + courses in class rep view
  // Same data source as CT Quiz Mgmt
}
```

---

## 📝 Adding New Department Data

### **Scenario: BioMed Engineering Curriculum Arrives**

**Step 1**: Update `curriculum-terms-courses.json`

```json
{
  "BioMed": {
    "name": "Biomedical Engineering",
    "semesters": {
      "1": {
        "termCode": "T2024S1",
        "termName": "Spring 2024",
        "startDate": "2024-01-15",
        "endDate": "2024-05-31",
        "courses": [
          { "id": "BM101", "code": "BM101", "name": "Biophysics", "credits": 3, "ctCount": 3, "quizCount": 1 },
          { "id": "BM102L", "code": "BM102L", "name": "BioMed Lab", "credits": 1.5, "ctCount": 2, "quizCount": 0 }
        ]
      }
    }
  }
}
```

**Step 2 (Optional)**: Add custom holidays to `holidays.json`

```json
{
  "2024": {
    "T2024S1": {
      "holidays": ["2024-03-17", "2024-04-14"],
      "nonInstructionWeeks": [
        { "start": "2024-02-01", "end": "2024-02-03" }
      ]
    }
  }
}
```

**Step 3**: That's it! Auto-works everywhere:
- ✓ CT Quiz page: "BioMed" shows in dropdown
- ✓ Schedule page: BioMed courses auto-load
- ✓ Term Planner: Credits and workload auto-calculate
- ✓ All pages: Use same data

---

## 🎯 Key Differences: V1 vs V2

| Feature | V1 | V2 |
|---------|----|----|
| **Term Selection** | Hardcoded | ✅ Dynamic dropdown |
| **Courses** | Hardcoded 2 | ✅ All from curriculum |
| **Holidays** | Hardcoded | ✅ Auto-load per term |
| **Teachers** | Not supported | ✅ Config panel + auto-sync |
| **Spacing Suggestions** | None | ✅ Smart calculations |
| **Data Reuse** | None | ✅ Shared across pages |
| **Customization** | Limited | ✅ Full editing |
| **Scalability** | 1 department | ✅ All departments |

---

## 🔐 Data Consistency & Sync

### **Single Source of Truth**

```
curriculum-terms-courses.json = Master Course List
     ↓
  All pages read from this
     ↓
Update once → All pages reflect change instantly
```

### **No Data Duplication**

❌ **Don't do**: Copy course list to multiple files
✅ **Do**: Import from curriculum-terms-courses.json

### **Holiday Consistency**

```
holidays.json = Holiday Master
     ↓
CT Quiz Mgmt: Excludes holidays in scheduling
Schedule Page: Shows holidays in calendar
Term Planner: Calculates available days
     ↓
All pages see same holidays = Consistent term view
```

---

## 📋 Checklist for Deployment

- [ ] `curriculum-terms-courses.json` created with all departments
- [ ] `holidays.json` created with all term holidays
- [ ] `CTQuizManagementV2.jsx` created
- [ ] `CTQuizManagementV2.css` created  
- [ ] App.jsx route updated to point to V2
- [ ] `SMART_ASSISTS_GUIDE.md` documented
- [ ] Test in browser:
  - [ ] Department selector works
  - [ ] Semester selector shows terms
  - [ ] Courses auto-load
  - [ ] Holidays load correctly
  - [ ] Spacing suggestions appear
  - [ ] Generate Schedule works
  - [ ] Export ICS/JSON works
  - [ ] Teacher configuration panel works
- [ ] Verify no console errors
- [ ] Test on mobile (responsive)
- [ ] Integration with Schedule page (if needed)

---

## 🚨 Troubleshooting

### **Courses not showing?**
- Check: `curriculum-terms-courses.json` has data for selected dept/sem
- Check: Department key matches (case-sensitive!)

### **Holidays not loading?**
- Check: `holidays.json` has entry for year/termCode
- Check: Date format is YYYY-MM-DD

### **Teachers not auto-populating?**
- Check: `schedule` page saves teachers to `course_teachers` localStorage key
- Check: Keys match between pages

### **CSS not applying?**
- Check: CSS import path in component
- Check: No conflicting global styles

---

## 📚 Related Documentation

- [SMART_ASSISTS_GUIDE.md](./SMART_ASSISTS_GUIDE.md) - Detailed assist explanations
- [curriculum-terms-courses.json](./src/data/curriculum-terms-courses.json) - Data structure
- [holidays.json](./src/data/holidays.json) - Holiday definitions
