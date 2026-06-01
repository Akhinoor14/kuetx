# CT & Quiz Management - Smart Assists & Architecture

## 📋 What Smart Assists Are Available

### 1. **Auto-Load Holidays for Selected Term**
```javascript
// Automatically loads holidays from holidays.json based on:
// - Year extracted from termCode (T2026S1 → 2026)
// - Specific term holidays (Eids, national holidays)
// - Non-instruction weeks (semester breaks)
```
**Benefit**: CR doesn't manually specify holidays; they're loaded automatically per term

### 2. **Auto-Load Courses for Department & Semester**
```javascript
// Pulls courses from curriculum-terms-courses.json
// Shows: course code, name, credits, CT count, quiz count
// CR can see exactly what courses are in their term
```
**Benefit**: No manual course list entry; curriculum data is single source of truth

### 3. **Spacing Suggestions**
```javascript
// Calculates:
// - Total instruction days available (excluding holidays)
// - Suggested minimum gap between CTs
// - Guidance like "45 instruction days available"
```
**Benefit**: CR gets intelligent suggestions based on actual term length

### 4. **Default Teacher Names (with Auto-Update)**
```javascript
// Initially shows: "Teacher 1", "Teacher 2", etc.
// When teachers are assigned in Schedule page and saved to store:
// - Next time this page loads, real teacher names appear
// - Fall back to defaults if not assigned yet
```
**Benefit**: CR can work immediately, but teacher names auto-update when available

### 5. **Custom Course Design (Editable)**
```javascript
// CR can:
// - Adjust CT counts per course (if needed)
// - Manually edit generated dates
// - Assign custom teacher names
// - Save all customizations per term
```
**Benefit**: System suggests, but CR has full control

## 🔄 Data Reuse Pattern (Across All Pages)

### Master Data File: `curriculum-terms-courses.json`
```json
{
  "departments": {
    "CSE": {
      "name": "Computer Science & Engineering",
      "semesters": {
        "1": {
          "termCode": "T2024S1",
          "termName": "Spring 2024",
          "startDate": "2024-01-15",
          "endDate": "2024-05-31",
          "courses": [
            { "id": "CSE101", "code": "CSE101", "name": "...", "ctCount": 3, "quizCount": 0 }
          ]
        }
      }
    }
  }
}
```

### Usage Across Pages:

| Page | Uses | Data Type |
|------|------|-----------|
| **Schedule** | courses, termDates | curriculum-terms-courses.json |
| **CT Quiz Mgmt** | courses, holidays | curriculum-terms-courses.json + holidays.json |
| **Term Planner** | course credits, term length | curriculum-terms-courses.json |
| **Class Management** | courses, terms | curriculum-terms-courses.json |
| **Assignments** | course codes | curriculum-terms-courses.json |

### Example: Reusing in Schedule Page
```javascript
import curriculumData from '../data/curriculum-terms-courses.json';

// Automatically get all courses for a department's semester
const courses = curriculumData.departments['CSE']?.semesters['1']?.courses;
// Now show them in schedule UI without separate API call
```

## 📝 Template for Incomplete Department Data

Create `CURRICULUM_STATUS.md` in root:

```markdown
# Curriculum Status - Departments with Incomplete Data

## ✅ Complete (Ready)
- CSE: All semesters and courses defined
- EEE: Spring 2024, Summer 2024 ready
- ME: 2026-2027 academic year ready

## ⏳ In Progress - Notes File

### BioMed Engineering
- **Status**: Waiting for official curriculum
- **File**: `/src/data/notes/BioMed-curriculum-todo.md`
- **What's Missing**: All semesters and course lists
- **ETA**: After Dean approval
- **Contacts**: Dr. Karim (Dept Head)

### Textile Engineering
- **Status**: Semester 1 complete, Semester 2 pending
- **File**: `/src/data/notes/Textile-curriculum-todo.md`
- **What's Done**: 
  - Semester 1: All 8 courses with CT/quiz counts
- **What's Missing**: Semester 2 course list
- **ETA**: By June 15, 2024
- **Contacts**: Prof. Hasan (Academic Coordinator)

### Architecture
- **Status**: Under review
- **File**: `/src/data/notes/Architecture-curriculum-todo.md`
- **What's Missing**: Full curriculum + term dates
- **ETA**: After faculty meeting (June 30)

## When Data Arrives

1. Add to `curriculum-terms-courses.json`
2. Add holidays to `holidays.json` (if different from standard)
3. Remove from "In Progress" section
4. CT Quiz Management page auto-updates
```

Example `Textile-curriculum-todo.md`:
```markdown
# Textile Engineering - Curriculum Data

## Semester 1 (Spring 2024) ✅ COMPLETE
- Courses added to curriculum-terms-courses.json
- Holidays updated in holidays.json

## Semester 2 (Summer 2024) ⏳ PENDING

### Courses (Need to Confirm):
- [ ] Text. 201 - Fiber Technology (3 credits, 3 CTs?)
- [ ] Text. 202 - Dyeing & Printing (3 credits, ?)
- [ ] Text. 203L - Textile Lab (1.5 credits, ?)
- [ ] Spinning 101 - (3 credits, ?)

### Notes:
- Waiting for Prof. Hasan to confirm CT counts
- Holiday dates same as other departments
- Add when Prof. Hasan confirms

## Last Updated: 2024-05-20
## Contact: Prof. Hasan (hasan@kuet.ac.bd)
```

## 🔗 How Smart Assist Detects Teacher Names

### Current Flow:
```
1. Schedule page → User assigns teacher to courses
   (saves to: scheduleData in localStorage/store)

2. CT Quiz Mgmt page loads:
   - First checks: scheduleData.courses[courseId].teachers
   - If found → Shows real names
   - If not found → Shows "Teacher 1", "Teacher 2" (defaults)

3. Teacher name editable here too:
   - Changes save to this page's localStorage
   - Schedule page doesn't overwrite
   - Both pages read from store (single source)
```

### To Enable Cross-Page Teacher Data:

**In store/store.js**:
```javascript
export function saveTeachersForCourse(courseId, teachers) {
  const current = localStorage.getItem('course_teachers') || '{}';
  const data = JSON.parse(current);
  data[courseId] = teachers;
  localStorage.setItem('course_teachers', JSON.stringify(data));
}

export function getTeachersForCourse(courseId) {
  const data = JSON.parse(localStorage.getItem('course_teachers') || '{}');
  return data[courseId] || null;
}
```

**In CT Quiz Mgmt**:
```javascript
const courseTeachers = getTeachersForCourse(courseId) || ['Teacher 1', 'Teacher 2'];
```

## 🎨 Key Features of V2

| Feature | Before | Now |
|---------|--------|-----|
| **Term Selection** | Hardcoded | Dropdown selector |
| **Courses** | Hardcoded 2 courses | Auto-loaded from curriculum |
| **Holidays** | Static | Auto-loaded per term |
| **Teachers** | N/A | Configurable with auto-defaults |
| **Spacing Suggestions** | None | Calculated per term length |
| **Customization** | Limited | Full editing + save |
| **Data Reuse** | None | Shared across pages |

## 📊 Term Info Reuse Across Pages

### 1. **Schedule Page**
```javascript
// Auto-show courses for current term
const courses = curriculumData.departments[userDept]?.semesters[userSem]?.courses;
```

### 2. **Term Planner**
```javascript
// Calculate workload based on credit hours
const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
```

### 3. **Attendance Page**
```javascript
// Show term dates for attendance calculation
const { startDate, endDate } = termData;
```

### 4. **Class Management**
```javascript
// List all courses to manage (from curriculum)
const courses = termData.courses;
```

## 🚀 Adding New Department

### Step 1: Add to `curriculum-terms-courses.json`
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
          { "id": "BM101", "code": "BM101", "name": "...", "credits": 3, "ctCount": 3, "quizCount": 0 }
        ]
      }
    }
  }
}
```

### Step 2 (Optional): Add custom holidays to `holidays.json`
```json
{
  "2024": {
    "T2024S1": {
      "holidays": ["2024-03-17", "2024-04-14"],
      "nonInstructionWeeks": [...]
    }
  }
}
```

### Step 3: Auto-Works
- CT Quiz page: Department shows up in dropdown
- Schedule page: Courses load automatically
- All pages: Use the data automatically

---

## 🔧 Configuration for CR

When CR logs in:
```javascript
const profile = getProfile(); // { dept: "ME", semester: "1" }

// CT Quiz Mgmt uses:
const defaultDept = profile.dept; // Auto-select "ME"
const defaultSem = profile.semester; // Auto-select "1"
```

CR can change from dropdown, but defaults match their profile.

---

## ✨ Summary: Smart Assists Enable

1. **No Manual Data Entry** - Curriculum is master source
2. **Term-Aware Everything** - Holidays, courses, dates auto-match
3. **Teacher Name Auto-Sync** - When assigned elsewhere, shows here
4. **Spacing Intelligence** - Suggests based on actual term length
5. **Full Control** - CR can override anything, but system suggests smartly
6. **Data Consistency** - Same course list across all pages
7. **Easy Expansion** - Add new department = instant availability everywhere
