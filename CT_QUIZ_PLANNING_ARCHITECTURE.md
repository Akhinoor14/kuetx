# CT & Quiz Smart Planning System — Architecture & Implementation

## Overview

The CT & Quiz Smart Planning System is a production-grade academic planning assistant for class representatives (CRs) at KUET. It provides intelligent scheduling of Class Tests (CTs) and Quizzes with smart recommendations, pressure-aware planning, and deep integration with the existing ecosystem.

### Key Characteristics
- **Smart**: Intelligent pressure calculation, multi-model generation, automated recommendations
- **Minimal**: Clean UI, non-cluttered, fast, mobile-friendly
- **Scalable**: Supports all 16 KUET departments, all academic terms
- **Integrated**: Uses existing profile, schedule, curriculum, and holiday systems
- **Pressureaware**: Calculates workload distribution and provides relief suggestions

---

## Architecture

### 1. Data Layer (`src/lib/ctQuizStore.js`)

**Purpose**: Centralized access to existing ecosystem data

**Key Functions**:
- `getTermHolidays(termCode)` — Load holiday dates from `/data/holidays.json`
- `getTermTimelineInfo(profile)` — Get term dates, week count, instruction timeline
- `getCurrentTermCourses(profile)` — Retrieve courses for current term with teacher assignments
- `getCTQuizPlans(profile)` — Load saved plans from store
- `saveCTQuizPlans(plans, profile)` — Persist plans to `store` with key `ct_quiz_plans`
- `calculateInstructionDays(...)` — Compute business days (excluding weekends/holidays)
- `generateCTDates(...)` — Generate evenly-spaced CT dates

**Data Reuse Strategy**:
- Uses `getProfile()` for dept, session, currentTermKey
- Uses `getCurrentTermKey(profile)` for active term
- Uses `getTermTimeline()` for term dates and metadata
- Uses `getAllCourses(profile)` for curriculum courses
- Uses `scheduleSettings.courseTeacherMap` for teacher assignments
- Uses `/data/holidays.json` for holiday dates

**Storage Structure**:
```javascript
// Store key: 'ct_quiz_plans'
{
  'Y1T1': { termCode, dept, model, courses: [...], lastModified },
  'Y1T2': { ... },
  ...
}
```

---

### 2. Scheduling Engine (`src/lib/ctQuizScheduler.js`)

**Purpose**: Intelligent scheduling logic with multiple models and recommendations

**Core Concept**:
- **Scheduling Models**: Different distribution strategies
  - `balanced` — Evenly spaced (12-day minimum gap)
  - `distributed` — Maximum spacing (16-day gap, low pressure)
  - `low-pressure` — Very generous (18-day gap)
  - `compact` — Concentrated (8-day gap)
  - `teacher-centric` — Teacher availability aligned (12-day gap)

**Key Functions**:

1. **`scheduleCourseCTs(options)`**
   - Input: course details, term dates, holidays, number of CTs, teachers, model
   - Output: CT dates, teacher assignments, pressure score, warnings
   - Algorithm:
     1. Calculate available instruction days (excluding opening/closing weeks + holidays)
     2. Generate evenly-spaced dates based on model
     3. Assign CTs to teachers (for theory: distribute; for lab: single teacher)
     4. Calculate pressure score

2. **`calculatePressureScore(dates, totalDays)`**
   - Scoring logic:
     - Base: 50
     - Penalty for small gaps (< 10 days: +20, < 14 days: +10)
     - Reward for large gaps (> 20 days: -15, > 17 days: -10)
     - Penalty for uneven spacing (high variance: +10)
     - Penalty for late-term concentration (+15)
   - Range: 0-100 (0 = low pressure, 100 = very high)

3. **`generateMultipleModels(options)`**
   - Generate all 5 models and rank by pressure
   - Used for "smart recommendations"

4. **`getSmartRecommendations(courses, termInfo)`**
   - Pressure balance detection
   - Conflict warning (3+ CTs on same date)
   - Early-term coverage validation
   - Returns actionable recommendations

5. **`validateSchedule(courses, termInfo)`**
   - Detect overlapping CTs
   - Flag last-week scheduling
   - Return warnings

---

### 3. UI Layer (`src/pages/CTQuizPlanning.jsx`)

**Purpose**: User interface for planning and customization

**Components**:
- **Header**: Term info, status cards (course count, avg pressure, current model)
- **Export/Import**: JSON-based plan sharing and backup
- **Smart Recommendations**: Pressure balance, conflict detection, coverage alerts
- **Model Selector**: 5 model options with descriptions and icons
- **Course Listing**: Collapsible course cards with CT dates and teachers
- **Validation Warnings**: Schedule quality alerts
- **Pressure Visualization**: Color-coded pressure indicators (green/amber/red)

**Data Flow**:
1. Load → Fetch profile, term info, courses from ecosystem
2. Generate → If first time, auto-generate schedule for all courses
3. Display → Show current model, pressure, recommendations
4. Modify → Change model, regenerate all courses
5. Export/Import → Save/restore plans as JSON
6. Save → Auto-save to store after any change

**Features**:
- ✅ Real-time pressure calculation
- ✅ Smart assist recommendations (collapsible)
- ✅ Validation warnings display
- ✅ Export to JSON for backup/sharing
- ✅ Import from JSON to restore
- ✅ Multi-device sync via store
- ✅ All data stored locally (offline-first)

---

## Data Flow Integration

### System Connections

```
Profile Setup
    ↓
    └→ dept, session, currentTermKey
         ↓
         └→ [CT Planning uses for filtering]

Schedule Page
    ↓
    ├→ courseTeacherMap (teacher assignments)
    └→ courseShortNameMap
         ↓
         └→ [CT Planning enriches courses with teachers]

Curriculum Store
    ↓
    └→ getAllCourses(profile) — all dept/term courses
         ↓
         └→ [CT Planning generates schedules]

Holiday Data (/data/holidays.json)
    ↓
    └→ getTermHolidays(termCode) — holiday dates
         ↓
         └→ [CT Planning excludes holidays from scheduling]

Term Timeline
    ↓
    └→ getTermTimeline() — term dates, weeks, metadata
         ↓
         └→ [CT Planning uses for boundary calculations]
```

---

## Scheduling Algorithm

### Step 1: Calculate Instruction Days
```
termStart + 2 weeks (opening)
    ↓
    └→ Available days (exclude weekends + holidays)
         ↓
    termEnd - 1 week (closing)
```

### Step 2: Generate Dates Based on Model
```
Available days: [d1, d2, d3, ..., dn]
Number of CTs: 3
Model gap requirement: 12 days (balanced)

Formula: step = floor((n - 1) / (numCTs + 1))
Selected: [d_{1*step}, d_{2*step}, d_{3*step}]
```

### Step 3: Assign to Teachers
```
Theory (2 teachers):
  CT 1 → Teacher 1
  CT 2 → Teacher 2
  CT 3 → Combined/All Teachers

Lab/Sessional (1 teacher):
  Quiz → Lab Instructor
```

### Step 4: Calculate Pressure
```
gaps = [d2-d1, d3-d2, ...]
avgGap = sum(gaps) / len(gaps)

score = 50
  + penalty(minGap < threshold)
  - reward(avgGap > threshold)
  + penalty(high variance)
  + penalty(late-term concentration)
```

---

## Academic Rules Implemented

✅ **No CT in first 2 weeks** — `skipFirstWeeks = 2`
✅ **No CT in last week** — `skipLastWeeks = 1`
✅ **Exclude holidays** — All holidays from `holidays.json`
✅ **Exclude weekends** — Saturdays & Sundays excluded
✅ **3 CTs minimum (theory)** — Default for 3+ credit courses
✅ **1 Quiz (sessional)** — Labs get 1 quiz, typically mid-lab
✅ **Teacher distribution** — CTs spread across assigned teachers
✅ **Holiday-aware spacing** — Gaps calculated excluding holidays

---

## Storage & Persistence

### Store Key Structure
```javascript
store.get('ct_quiz_plans') → {
  'Y1T1': {
    termCode: 'T2026S1',
    dept: 'ME',
    model: 'balanced',
    courses: [
      {
        courseId: 'ME101',
        courseName: 'Thermodynamics',
        courseType: 'theory',
        credits: 3,
        numCTs: 3,
        ctDates: ['2026-09-15', '2026-10-20', '2026-11-25'],
        ctTeacherMap: { '2026-09-15': 'Dr. Ahmed', ... },
        teachers: ['Dr. Ahmed', 'Dr. Khan'],
        pressure: 38,
        warnings: [],
        success: true,
      },
      ...
    ],
    lastModified: '2026-06-01',
  },
  'Y1T2': { ... },
  ...
}
```

### Automatic Sync
- Plans saved to `store` (IndexedDB with localStorage fallback)
- Auto-saves after model changes
- Exports include metadata for restoration
- Imports merge with existing plans

---

## Export/Import Workflow

### Export Format
```javascript
{
  exportedAt: '2026-06-01T10:30:00Z',
  profile: {
    dept: 'ME',
    termKey: 'Y1T1',
  },
  plans: { /* full ct_quiz_plans structure */ }
}
```

### Use Cases
- **Backup**: Export before major changes
- **Sharing**: Share plan with other CRs
- **Archival**: Store historical plans
- **Restoration**: Import to recover from errors

---

## Route & Navigation

### Route
- **Path**: `/ct-quiz-planning`
- **Component**: `src/pages/CTQuizPlanning.jsx`
- **Requirement**: `requiresCR: true` (Class Rep only)
- **Navigation Entry**: "Class Rep" section → "CT & Quiz Planning"

### Access Control
- Visible in sidebar only if `profile.isCR === true`
- Requires profile setup first
- Redirects to profile if incomplete

---

## Smart Recommendations Logic

### Pressure Balance
```javascript
avgPressure = sum(course.pressure) / numCourses

if (avgPressure > 65) → "High pressure, switch models"
else if (avgPressure > 50) → "Moderate, acceptable"
else → "Low pressure, good coverage"
```

### Conflict Detection
```javascript
dateCount = count CTs per date
if any date has 3+ CTs → "Reschedule to prevent overload"
```

### Coverage Check
```javascript
earlyTests = CTs in first 14 days
if (earlyTests === 0) → "Good, avoids opening week pressure"
```

---

## Future Enhancement Possibilities

### Phase 2: Custom Design Mode
- Drag/drop CT rescheduling
- Manual date picker
- Real-time conflict highlighting
- Pressure score live update

### Phase 3: Calendar Visualization
- Month view with CT overlay
- Holiday visualization
- Teacher conflict highlighting
- Export to ICS format

### Phase 4: Collaboration Features
- Share plans with co-CRs
- Merge plans from multiple sections
- Conflict resolution helper
- Announcement scheduling

### Phase 5: Advanced Analytics
- Historical pressure trends
- Best-performing models by dept
- Predictive conflict detection
- Performance correlation with exam results

---

## Troubleshooting

### Plans Not Saving
- Check browser storage quota
- Verify profile is complete
- Ensure Store is initialized

### No Courses Appearing
- Verify profile dept and termKey are correct
- Check curriculum data for the term
- Ensure teacher assignments exist in Schedule

### Pressure Score Inconsistent
- Recalculate by changing model
- Check holiday dates in `/data/holidays.json`
- Verify term dates in profile

### Import Failing
- Verify JSON format is correct
- Check that exported dept matches current profile dept
- Use browser console to inspect error

---

## API Reference

### ctQuizStore.js

```javascript
// Data Retrieval
getTermHolidays(termCode) → string[]
getTermTimelineInfo(profile) → Object
getCurrentTermCourses(profile) → Course[]
getDepartmentInfo(deptCode) → Department

// Planning
getCTQuizPlans(profile) → Plan | null
saveCTQuizPlans(plans, profile) → boolean
calculateInstructionDays(...) → string[]
generateCTDates(availableDays, numCTs, minGap) → {dates, warnings}

// Export/Import
exportPlansAsJSON(profile) → ExportData
importPlansFromJSON(data, profile) → boolean
```

### ctQuizScheduler.js

```javascript
// Models
SCHEDULING_MODELS → {balanced, distributed, ...}

// Scheduling
scheduleCourseCTs(options) → ScheduleResult
generateMultipleModels(options) → ScheduleResult[]

// Analysis
calculatePressureScore(dates, totalDays) → 0-100
getSmartRecommendations(courses, termInfo) → Recommendation[]
validateSchedule(courses, termInfo) → ValidationIssue[]
```

---

## File Structure

```
src/
  ├─ lib/
  │  ├─ ctQuizStore.js         ← Data layer
  │  └─ ctQuizScheduler.js      ← Scheduling logic
  ├─ pages/
  │  └─ CTQuizPlanning.jsx      ← Main UI
  ├─ data/
  │  └─ holidays.json           ← Holiday definitions (already exists)
  ├─ store/
  │  └─ store.js                ← Centralized store (already exists)
  └─ nav.js                      ← Navigation config (updated)
```

---

## Maintenance Notes

### When Adding New Departments
1. Add department to `DEPARTMENTS` in `store.js` ✓ Already exists
2. Ensure curriculum data exists in curriculum store ✓ Already exists
3. System auto-detects new departments via `getDepartmentInfo()`

### When Modifying Holiday Structure
1. Update `/data/holidays.json` format documentation
2. Adapt `getTermHolidays()` parser if structure changes
3. Test with multiple years

### When Changing Academic Calendar
1. Update `skipFirstWeeks` and `skipLastWeeks` if rules change
2. Adjust model gap defaults if spacing requirements change
3. Update academic rules documentation above

---

## Testing Checklist

- [ ] Generate schedule for each department
- [ ] Verify CT dates exclude first 2 weeks
- [ ] Verify CT dates exclude last week
- [ ] Verify CT dates exclude holidays
- [ ] Verify CT dates exclude weekends
- [ ] Test all 5 scheduling models
- [ ] Verify pressure scores differ between models
- [ ] Export and import plans successfully
- [ ] Verify teacher assignments are correct
- [ ] Test on mobile and desktop
- [ ] Verify CR-only access control
- [ ] Test with incomplete profile (should show error gracefully)
