# Incomplete Department Data - Template & Tracking

## 📝 How to Handle Missing Curriculum Data

When a department's data isn't ready yet, we document it with a status file so everyone knows what's pending.

---

## 📋 Master Status File

**File**: `CURRICULUM_COMPLETION_STATUS.md` (at project root)

```markdown
# Curriculum Data Completion Status

Last Updated: 2024-05-20

## ✅ Complete Departments

### CSE (Computer Science & Engineering)
- **Semester 1**: All courses defined
- **Semester 2**: All courses defined
- **Holidays**: Configured for all terms
- **Status**: READY FOR PRODUCTION
- **Last Update**: 2024-05-01

### ME (Mechanical Engineering)
- **Semester 1**: All courses defined  
- **Semester 2**: All courses defined
- **Holidays**: Standard KUET calendar applied
- **Status**: READY FOR PRODUCTION
- **Last Update**: 2024-05-15

### EEE (Electrical & Electronic Engineering)
- **Semester 1**: All courses defined
- **Semester 2**: PENDING (see below)
- **Holidays**: Configured for Semester 1
- **Status**: PARTIALLY READY
- **Last Update**: 2024-05-18

---

## ⏳ In Progress - Awaiting Data

### BioMed Engineering

**Status**: PENDING - Waiting for official curriculum

**File Location**: `src/data/notes/BioMed-pending.md`

**What's Missing**:
- [ ] Semester 1 course list (expected 8-10 courses)
- [ ] Semester 2 course list
- [ ] Credit hours per course
- [ ] CT count per course
- [ ] Quiz count per course
- [ ] Special holiday dates (if different from standard)

**Expected Completion**: June 30, 2024

**Contact**: Dr. Karim Hasan (Dept Head)
- Email: karim@kuet.ac.bd
- Phone: +880-1XXX-XXXXXX

**Action Items**:
1. Schedule meeting with Dr. Karim by June 20
2. Request curriculum document + CT/quiz count confirmation
3. Enter into curriculum-terms-courses.json
4. Update holidays.json (if custom)
5. Test in CT Quiz Management page
6. Remove from "In Progress" section

**Notes**: 
- Dr. Karim promised curriculum by mid-June in last meeting
- Has template for course format
- May have special lab requirements (check for extra CTs)

---

### Textile Engineering

**Status**: PENDING - Semester 2 incomplete

**File Location**: `src/data/notes/Textile-pending.md`

**What's Done**:
- ✅ Semester 1: All 8 courses complete with CT/quiz counts
- ✅ Holidays: Confirmed same as standard KUET calendar

**What's Missing**:
- [ ] Semester 2 course list
- [ ] CT counts for Semester 2
- [ ] Quiz counts for Semester 2
- [ ] Clarify if spinning lab has special requirements

**Expected Completion**: June 15, 2024

**Contact**: Prof. Hasan Ahmed (Academic Coordinator)
- Email: hasan.ahmed@kuet.ac.bd
- Phone: +880-1XXX-XXXXXX
- Office: Department of Textile Engineering, Building C

**Action Items**:
1. Email Prof. Hasan + ask for Semester 2 courses (do by June 1)
2. Confirm spinning lab CT counts
3. Add to curriculum-terms-courses.json
4. Verify in CT Quiz Management page
5. Remove from "In Progress" section

**Notes**:
- Waiting for Textile committee meeting (June 5) for final curriculum
- Spinning lab may need 4 CTs instead of 3 (clarify!)
- Prof. Hasan usually responds within 2 days

---

### Architecture

**Status**: PENDING - Under faculty review

**File Location**: `src/data/notes/Architecture-pending.md`

**What's Missing**:
- [ ] Full curriculum (all semesters)
- [ ] Course codes and names
- [ ] Credit hours
- [ ] CT/quiz count per course
- [ ] Special assessment requirements (design projects?)

**Expected Completion**: July 31, 2024

**Contact**: Dean of Architecture (Faculty Head)
- Email: dean.arch@kuet.ac.bd

**Status**: Faculty is undergoing curriculum revision. New curriculum expected by end of June.

**Action Items**:
1. Check with Dean office in late June
2. Request revised curriculum document
3. Schedule meeting to clarify CT/quiz requirements
4. Enter into system
5. Test across all pages

**Notes**:
- Architecture has design-based coursework - may need different assessment approach
- Possible special requirement: Project submissions instead of traditional CTs?
- Need clarification on how design projects count in CT Quiz system

---

## ⏳ Pending but Low Priority

### Urban Planning (URPL)

**File Location**: `src/data/notes/URPL-pending.md`

**Status**: No immediate requests yet. Add when department reaches out.

**Placeholder Data**:
```json
{
  "URPL": {
    "name": "Urban Planning",
    "semesters": {
      "1": {
        "termCode": "T2024S1",
        "termName": "Spring 2024",
        "startDate": "2024-01-15",
        "endDate": "2024-05-31",
        "courses": [
          {
            "id": "URPL_TODO",
            "code": "URPL101",
            "name": "TODO: Get from department",
            "credits": 3,
            "ctCount": 3,
            "quizCount": 0
          }
        ]
      }
    }
  }
}
```

---

## 🗂️ Individual Department Note Files

Each in-progress department has its own file:

### Location: `src/data/notes/`

**Directory Structure**:
```
src/data/notes/
├── BioMed-pending.md
├── Textile-pending.md
├── Architecture-pending.md
└── URPL-pending.md
```

---

## 📝 Individual Note File Template

**File**: `src/data/notes/[DeptName]-pending.md`

```markdown
# [Department Name] - Curriculum Data (PENDING)

## Current Status

**Completion**: 0% (Waiting for initial data)
**Target Date**: [Expected date]
**Contact**: [Department head name + email]

## What We Need

### Semester 1
- [ ] Course list (codes, names, credits)
- [ ] CT count per course
- [ ] Quiz count per course
- [ ] Any special requirements?

Example format:
```
DEP101 - Intro to Department (3 credits, 3 CTs, 1 Quiz)
DEP102L - Lab (1.5 credits, 2 CTs, 0 Quizzes)
```

### Semester 2
- [ ] Course list
- [ ] CT/quiz counts
- [ ] Special requirements

### Holiday Information
- [ ] Any dept-specific holidays beyond standard KUET calendar?
- [ ] Special lab/project periods?

## Data Entry Format

When received, add to `curriculum-terms-courses.json`:

```json
{
  "[DEPTCODE]": {
    "name": "[Full Department Name]",
    "semesters": {
      "1": {
        "termCode": "T2024S1",
        "termName": "Spring 2024",
        "startDate": "2024-01-15",
        "endDate": "2024-05-31",
        "courses": [
          {
            "id": "[COURSE_ID]",
            "code": "[COURSE_CODE]",
            "name": "[Course Name]",
            "credits": [NUMBER],
            "ctCount": [NUMBER],
            "quizCount": [NUMBER]
          }
        ]
      }
    }
  }
}
```

## Timeline

| Date | Action | Owner |
|------|--------|-------|
| 2024-05-20 | Initial request sent | [Your name] |
| 2024-06-10 | Follow-up if no response | [Your name] |
| 2024-06-[Date] | Data received | [Department contact] |
| 2024-06-[Date] | Entry into system | [Your name] |
| 2024-06-[Date] | Testing + verification | [Your name] |
| 2024-06-[Date] | Remove from "In Progress" | [Your name] |

## Notes

- Department replied on [Date]: "Will send by [target date]"
- Special considerations: [Any unique requirements]
- Previous curriculum version: [Link/reference if applicable]

## Last Updated

- Date: 2024-05-20
- By: [Your name]
- Status: Awaiting initial data
```

---

## 🚀 Adding Data from Note File to System

### **Step 1: Receive Curriculum**
```
Department sends: Email with course list
Format: Could be PDF, Excel, Word doc, etc.
```

### **Step 2: Extract Key Info**
```
From department document, extract:
- Course Code (CSE101)
- Course Name (Intro to CS)
- Credits (3)
- CT Count (3)
- Quiz Count (0)
```

### **Step 3: Add to curriculum-terms-courses.json**
```json
{
  "CSE": {
    "name": "Computer Science & Engineering",
    "semesters": {
      "1": {
        "termCode": "T2024S1",
        "termName": "Spring 2024",
        "startDate": "2024-01-15",
        "endDate": "2024-05-31",
        "courses": [
          {
            "id": "CSE101",
            "code": "CSE101",
            "name": "Intro to CS",
            "credits": 3,
            "ctCount": 3,
            "quizCount": 0
          }
        ]
      }
    }
  }
}
```

### **Step 4: Update Note File**
```markdown
## Current Status

**Completion**: 100% ✅
**Status**: READY FOR PRODUCTION
**Entered**: 2024-06-15
```

### **Step 5: Update Master Status**
```markdown
### CSE (Computer Science & Engineering)
- **Semester 1**: ✅ All courses defined
- **Status**: READY FOR PRODUCTION
- **Last Update**: 2024-06-15
```

### **Step 6: Test**

Open CT Quiz Management page:
1. Select CSE from Department dropdown
2. Select Semester 1 from dropdown
3. Verify all courses appear
4. Generate a test schedule
5. Verify dates are calculated correctly

### **Step 7: Commit & Document**

```bash
git add src/data/curriculum-terms-courses.json
git add src/data/notes/CSE-pending.md
git commit -m "Add CSE curriculum data - Semester 1 complete"
```

---

## 📊 Quick Status Checklist

```markdown
## Curriculum Completion Checklist

- [x] CSE - All semesters complete
- [x] ME - All semesters complete
- [x] EEE - Semester 1 complete
- [ ] EEE - Semester 2 pending (contact: Prof. Sohail)
- [ ] BioMed - All pending (contact: Dr. Karim)
- [ ] Textile - Semester 1 complete, Semester 2 pending
- [ ] Architecture - All pending (under faculty review)
- [ ] URPL - Not yet started

Total: 3.5 / 8 departments complete (43%)
```

---

## 🔄 When Data Arrives: Quick Process

```
Email from Department
        ↓
Open corresponding src/data/notes/[Dept]-pending.md
        ↓
Extract course info from email/document
        ↓
Add to curriculum-terms-courses.json
        ↓
Update src/data/notes/[Dept]-pending.md (mark as done)
        ↓
Update CURRICULUM_COMPLETION_STATUS.md (move to complete)
        ↓
Test in CT Quiz Management page
        ↓
Commit: git add && git commit -m "Add [Dept] curriculum"
        ↓
Done! Auto-works everywhere
```

---

## 💡 Benefits of This Approach

✅ **Transparent**: Everyone knows what's pending  
✅ **Organized**: One file per department  
✅ **Trackable**: Clear owners and deadlines  
✅ **Flexible**: Handles partial data (e.g., Textile: S1 done, S2 pending)  
✅ **Scalable**: Same process for all departments  
✅ **Auto-Works**: Once added, data available everywhere  

---

## 📞 Communication Template

**Email to Department** (when requesting data):

```
Subject: Curriculum Data Needed for CT & Quiz Management System

Dear [Department Head],

We're building a CT & Quiz Management System for class representatives
to efficiently schedule continuous tests and quizzes.

To include [Department Name] in this system, we need:

1. Course list for each semester:
   - Course Code (e.g., ABC101)
   - Course Name
   - Credits
   - Number of CTs planned per course
   - Number of Quizzes planned per course

2. Any special holidays or assessment periods specific to your department

Template format:
ABC101 - Intro Course (3 credits, 3 CTs, 1 Quiz)
ABC102L - Lab (1.5 credits, 2 CTs, 0 Quizzes)

Please send by: [Target Date]

This will enable:
- CRs to automatically plan CT schedules
- Students to see all CTs in their calendar
- Conflicts to be detected automatically
- Schedules to export to Google Calendar, Outlook, etc.

Thank you!
[Your Name]
```

---

## 🎯 Key Takeaway

**Don't wait for complete data:**
1. Track what's pending with MD files
2. Add departments as data arrives
3. System automatically makes it available everywhere
4. No re-work needed - data entered once, used everywhere
