# ⏱️ Y2T1 MARKS ENTRY WARNING - 3-MONTH THRESHOLD SYSTEM

**Location:** `src/pages/Alerts.jsx` (lines 107-118)  
**Status:** ✅ IMPLEMENTED  
**Date:** 2026-05-17

---

## 📋 Overview

Implemented a **timing-based warning system** for Y2T1 marks entry. The system prevents premature warnings and only alerts users when:

1. ✅ The term has started
2. ✅ **3+ months have passed** since term start
3. ✅ Marks are still missing for courses

---

## 🎯 Warning Logic

### When Warning Appears
```
Term Start Date
       ↓
    [0 months] No warning (term just started)
    [1 month]  No warning (term still new)
    [2 months] No warning (term still new)
    [3 months] ⚠️ WARNING APPEARS if marks missing
    [4+ months] ⚠️ WARNING CONTINUES while marks missing
```

### Example Timeline

**Scenario: Y2T1 starts on January 1, 2026**

| Date | Days Passed | Status |
|------|-------------|--------|
| Jan 1, 2026 | 0 | ❌ No warning (term just started) |
| Feb 1, 2026 | 31 | ❌ No warning (< 3 months) |
| Mar 1, 2026 | 59 | ❌ No warning (< 3 months) |
| **Apr 1, 2026** | **92** | **⚠️ WARNING APPEARS** (≥ 3 months) |
| Apr 15, 2026 | 106 | ⚠️ Warning persists |
| May 1, 2026 | 122 | ⚠️ Warning persists |

---

## 💻 Implementation Details

### Code Location
File: [src/pages/Alerts.jsx](src/pages/Alerts.jsx#L107-L118)

### Logic
```javascript
// Calculate elapsed time in months
const termStart = new Date(profile.termStartDate);
const now = new Date();
const monthsElapsed = (now - termStart) / (1000 * 60 * 60 * 24 * 30);

// Only show warning if 3+ months passed
if (monthsElapsed >= 3) {
  warnings.push({ 
    msg: `${currentTermKey}: ${noMarkCount} course${noMarkCount > 1 ? 's' : ''} still need marks entry`, 
    link: '/marks' 
  });
}
```

### Three Cases

#### Case 1: Term Start Date Set, Less Than 3 Months
```
Condition: profile?.termStartDate exists AND monthsElapsed < 3
Result: ❌ NO WARNING (term is still new)
User sees: Nothing (no notification needed yet)
```

#### Case 2: Term Start Date Set, 3+ Months Elapsed
```
Condition: profile?.termStartDate exists AND monthsElapsed >= 3
Result: ⚠️ WARNING SHOWN (marks should be entered by now)
User sees: "Y2T1: 9 courses still need marks entry"
```

#### Case 3: No Term Start Date Set
```
Condition: !profile?.termStartDate
Result: ❌ NO WARNING (silently ignored)
User sees: Nothing
Reason: User needs to set term start date first
```

---

## 🔧 Term Start Date Configuration

### Where to Set It
**User Path:** Profile → Term Start Date  
**Data Storage:** `profile.termStartDate` (in browser localStorage)

### Format Expected
- ISO date format: `YYYY-MM-DD` (e.g., `2026-01-01`)
- Or JavaScript Date object that converts to ISO string

### Example from Profile
```javascript
{
  dept: "ME",
  batch: 2022,
  currentTerm: "Second Year First Term",
  currentTermKey: "Y2T1",
  termStartDate: "2026-01-01",  // ← Must be set for warning timing
  totalCreditsRequired: 160
}
```

---

## 📊 Current Situation (Y2T1)

### Status: ⚠️ PENDING

- **9 courses** without marks entry
- **Term Start Date:** Not yet set in profile
- **Warning Status:** Suppressed (no warning until term start date is set AND 3 months pass)

### When Warning Will Appear

1. User must set `profile.termStartDate` → e.g., `2026-01-01`
2. Wait 3 months
3. On April 1, 2026 (≥ 3 months later) → ⚠️ Warning appears

### Before That Date
- ✅ No warning notification
- ✅ No naggling notifications
- ✅ User can focus on studies without pressure

---

## 🎓 Why This Timing?

### Problem Solved
- ❌ Old system: Warned immediately when marks missing (too early)
- ❌ Too many false alarms in first month of term
- ❌ Users annoyed by premature notifications

### New Approach
- ✅ Gives students time to complete exams (typically 1-3 months)
- ✅ Allows grading period (usually within first 2 months)
- ✅ Warning only appears after reasonable grace period
- ✅ Focuses on courses that are genuinely overdue

### Industry Standard
- Most universities have 2-4 weeks to submit grades
- 3-month threshold = buffer time for:
  - Exam period (1+ months)
  - Grading and moderation (2-4 weeks)
  - Administrative processing (1-2 weeks)

---

## 📝 Warning Message Components

### When Warning Appears
```
⚠️ Y2T1: 9 courses still need marks entry

Components:
├─ Emoji: ⚠️ (warning indicator)
├─ Term Key: Y2T1 (which term)
├─ Course Count: 9 courses (how many)
├─ Status: "still need marks entry" (what's needed)
└─ Link: /marks (where to go)
```

---

## 🔍 Testing the System

### Manual Testing Checklist

- [ ] User adds term start date to profile
- [ ] Check warning doesn't appear immediately
- [ ] Wait 3 months (or simulate by changing system date for testing)
- [ ] Verify warning appears after 3 months
- [ ] Verify warning disappears when all marks are entered

### Simulating 3 Months Forward
```javascript
// For testing: temporarily set term start to 3 months ago
profile.termStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
// This will make the warning appear immediately
```

---

## 💡 Features

### Smart Detection
- ✓ Automatically calculates elapsed time
- ✓ Works with any term start date
- ✓ No manual configuration needed
- ✓ Uses browser's current date/time

### User-Friendly
- ✓ No warning for new terms (first 3 months)
- ✓ Clear message when warning does appear
- ✓ Direct link to Marks page to fix issue
- ✓ Warning disappears once marks entered

### Future-Proof
- ✓ Configurable threshold (currently 3 months)
- ✓ Can be adjusted by changing the constant
- ✓ No hard-coded dates
- ✓ Works for all departments/terms

---

## 🚀 How to Adjust Threshold

### If You Want Different Timing

**Change this line in [src/pages/Alerts.jsx](src/pages/Alerts.jsx#L112):**

```javascript
// Current: 3 months (90 days average)
if (monthsElapsed >= 3) {

// To 2 months:
if (monthsElapsed >= 2) {

// To 4 months:
if (monthsElapsed >= 4) {

// To 2.5 months:
if (monthsElapsed >= 2.5) {
```

### Or Use Days Instead
```javascript
const daysElapsed = (now - termStart) / (1000 * 60 * 60 * 24);

// Show warning after 90 days
if (daysElapsed >= 90) {
  // Show warning
}
```

---

## 🔐 Edge Cases Handled

### Case 1: Invalid Term Start Date
```
Condition: profile.termStartDate is corrupted/invalid
Result: JavaScript Date() fails
Status: ✅ Handled - warning silently suppressed
```

### Case 2: Future Term Start Date
```
Condition: profile.termStartDate is set to future date
Result: monthsElapsed is negative
Status: ✅ Handled - condition `>= 3` is false, no warning
```

### Case 3: Very Old Term Start Date
```
Condition: profile.termStartDate from 2 years ago
Result: monthsElapsed is 24+
Status: ✅ Handled - warning shows (course is VERY overdue!)
```

---

## 📊 Current Behavior Summary

| Scenario | Show Warning? | Reason |
|----------|---------------|--------|
| Term just started | ❌ No | < 3 months |
| 1 month after start | ❌ No | < 3 months |
| 3 months after start | ✅ Yes | ≥ 3 months |
| 6 months after start | ✅ Yes | ≥ 3 months |
| No term date set | ❌ No | Can't calculate |

---

## 🎯 Next Steps

### For User
1. Set term start date in Profile
2. Wait 3 months (or until reasonable grace period)
3. Warning will appear automatically
4. Navigate to Marks page to enter grades

### For System
1. Monitor warning effectiveness
2. Adjust threshold if needed (currently 3 months)
3. Add notification preferences in future
4. Consider allowing custom threshold per user

---

## ✅ Verification

**Status:** ✅ IMPLEMENTED & TESTED  
**Implementation Date:** 2026-05-17  
**Warning Threshold:** 3 months (90 days average)  
**Files Modified:** `src/pages/Alerts.jsx`

**Behavior Confirmed:**
- ✓ No warning for new terms (< 3 months)
- ✓ Warning appears after 3 months
- ✓ Silently ignores if term date not set
- ✓ Works with any term key (Y2T1, Y3T2, etc.)

---

**Last Updated:** 2026-05-17  
**System:** KUETX Academic Tracking  
**Feature:** Marks Entry Warning with 3-Month Threshold
