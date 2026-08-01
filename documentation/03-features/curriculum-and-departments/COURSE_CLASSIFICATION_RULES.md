# 🎓 PERMANENT COURSE CLASSIFICATION RULES

**Location:** `src/store/store.js`  
**Status:** ✅ ACTIVE - Applied globally to all departments  
**Last Updated:** 2026-05-17

---

## RULE 1: Course Type Detection (PERMANENT & OVERRIDE)

### Definition
The course type (Theory vs. Sessional) is determined **EXCLUSIVELY** by the **LAST DIGIT** of the course code's numeric portion.

### Logic
```
Last Digit Analysis:
├─ Even (0, 2, 4, 6, 8) → SESSIONAL
└─ Odd (1, 3, 5, 7, 9)  → THEORY
```

### Examples

| Course Code | Last Digit | Type | Reason |
|-----------|-----------|------|--------|
| **ME 2100** | 0 | **Sessional** | 0 is even ✓ |
| ME 2105 | 5 | Theory | 5 is odd ✓ |
| ME 2106 | 6 | **Sessional** | 6 is even ✓ |
| EE 2105 | 5 | Theory | 5 is odd ✓ |
| EE 2106 | 6 | **Sessional** | 6 is even ✓ |
| MSE 2101 | 1 | Theory | 1 is odd ✓ |
| MSE 2102 | 2 | **Sessional** | 2 is even ✓ |

### Implementation Details
```javascript
// Function: inferCourseTypeFromCode(code, currentType)
// Location: src/store/store.js line ~515
// 
// BEHAVIOR:
// 1. Extracts all digits from course code (e.g., "ME 2100" → "2100")
// 2. Takes the LAST digit (e.g., "2100" → "0")
// 3. Checks if even/odd
// 4. IGNORES currentType parameter - ALWAYS applies the rule
// 5. Returns 'Sessional' or 'Theory'
```

### Important Notes
- ⚠️ **This rule OVERRIDES any manually set type** - It's permanent and non-negotiable
- ✓ Automatically applied when courses are processed from curriculum
- ✓ Applied in `persist_syllabus_to_terms.cjs` during term file generation
- ✓ Applied in `src/store/store.js` during course data retrieval

---

## RULE 2: Year & Term Extraction (from Course Code)

### Definition
The course's **Year** and **Term** placement can be extracted from the **first two digits** of the course code's numeric portion.

### Logic
```
Course Code Format: [DEPT] XYYZ
                        ││
                        ││└─ Term (1 or 2)
                        │└─── Year (1, 2, 3, or 4)
                        └──── RULE APPLIES HERE

Examples:
  ME 2100 → Year: 2 (2nd Year), Term: 1 (1st Term) → Y2T1
  ME 2200 → Year: 2 (2nd Year), Term: 2 (2nd Term) → Y2T2
  ME 3105 → Year: 3 (3rd Year), Term: 1 (1st Term) → Y3T1
  ME 4204 → Year: 4 (4th Year), Term: 2 (2nd Term) → Y4T2
```

### Implementation Details
```javascript
// Function: extractYearTermFromCode(code)
// Location: src/store/store.js line ~505
//
// BEHAVIOR:
// 1. Extracts numeric portion from code (e.g., "ME 2100" → "2100")
// 2. Takes 1st digit → Year (must be 1-4)
// 3. Takes 2nd digit → Term (must be 1-2)
// 4. Returns {year: number, term: number}
//
// Returns null for invalid values
```

### Examples

| Course Code | Y/T | Meaning | Validation |
|-----------|-----|---------|-----------|
| ME 2100 | Y2T1 | 2nd Year, 1st Term | ✓ Valid |
| ME 2200 | Y2T2 | 2nd Year, 2nd Term | ✓ Valid |
| ME 3105 | Y3T1 | 3rd Year, 1st Term | ✓ Valid |
| ME 4204 | Y4T2 | 4th Year, 2nd Term | ✓ Valid |
| ME 1105 | Y1T1 | 1st Year, 1st Term | ✓ Valid |
| ME 5100 | Invalid | Year 5 doesn't exist | ✗ Rejected |
| ME 2300 | Invalid | Term 3 doesn't exist | ✗ Rejected |

---

## RULE 3: Placement Verification (Auto-Validation)

### When is Y/T verified?
- When importing curriculum from JSON
- When generating term files
- When displaying courses in UI

### What happens if mismatch is detected?
- ⚠️ **Warning** if a course code suggests Y2T1 but is placed in Y1T1
- 📌 The course **stays in the original term** (no auto-move)
- 🔍 Flagged for manual review

### Example
```
Course: ME 2100 (Computer Aided Drawing)
Code suggests: Y2T1
Currently placed in: Y2T1
Result: ✓ MATCH - No issue
```

---

## Course Classification Example: ME 2100

### Course Information
```
Code: ME 2100
Title: Computer Aided Drawing
Credit: 1.5
```

### Rule Applications

| Rule | Input | Process | Output |
|------|-------|---------|--------|
| **Type** | Code: ME 2100 | Last digit = 0 (even) | **Sessional** ✓ |
| **Year** | Code: ME 2100 | 1st digit = 2 | **Year 2** (Y2) ✓ |
| **Term** | Code: ME 2100 | 2nd digit = 1 | **Term 1** (T1) ✓ |
| **Result** | | | **Y2T1 Sessional** ✓ |

### Verification
```
✓ ME 2100 is correctly identified as:
  - Type: Sessional (last digit 0 is even)
  - Year/Term: Y2T1 (first digits 2,1)
  - Location: Should be in ME → Y2T1 curriculum
  - Status: ✓ CORRECT
```

---

## How These Rules Are Applied

### 1. In store.js (Main Logic)
```javascript
import { inferCourseTypeFromCode, extractYearTermFromCode } from './store.js';

// Type detection
const type = inferCourseTypeFromCode('ME 2100'); // Returns 'Sessional'

// Year/Term extraction
const {year, term} = extractYearTermFromCode('ME 2100'); // Returns {year: 2, term: 1}
```

### 2. In persist_syllabus_to_terms.cjs (Term Generation)
```javascript
// Script automatically applies type rule when generating term files
type: inferCourseTypeFromCode(codeKey, info.type)
```

### 3. In Components (UI Display)
```javascript
// Components can use these functions to validate and display course info
const courseType = inferCourseTypeFromCode(course.code);
const {year, term} = extractYearTermFromCode(course.code);
```

---

## Testing These Rules

### Manual Verification
```bash
# Test the functions in Node.js
node -e "
import('./src/store/store.js').then(store => {
  console.log(store.inferCourseTypeFromCode('ME 2100')); // 'Sessional'
  console.log(store.extractYearTermFromCode('ME 2100')); // {year: 2, term: 1}
  console.log(store.inferCourseTypeFromCode('ME 2105')); // 'Theory'
  console.log(store.extractYearTermFromCode('ME 2105')); // {year: 2, term: 1}
});
"
```

### Verification Checklist
- [ ] ME 2100 is detected as **Sessional** (not Theory)
- [ ] ME 2100 extracts Y2T1 (not another term)
- [ ] ME 2105 is detected as **Theory**
- [ ] ME 2105 extracts Y2T1
- [ ] All even-numbered courses in curriculum are Sessional
- [ ] All odd-numbered courses in curriculum are Theory
- [ ] No manual "Theory" marking overrides the permanent rule

---

## Important: Why These Rules Are Permanent

### Problem They Solve
1. **Consistency:** All departments follow same classification logic
2. **Automation:** No manual marking needed or possible
3. **Accuracy:** Code structure inherently encodes course type and placement
4. **Maintenance:** Single source of truth (the course code)

### Why They Override Manual Markings
- The course code IS the official specification
- Manual markings can be wrong
- These rules enforce data consistency automatically
- Better than requiring manual verification of 400+ courses

---

## Department Coverage

✅ **All departments apply these rules:**
- MTE (Mechatronics Engineering)
- MSE (Materials Science & Engineering)
- ESE (Energy Science & Engineering)
- ECE (Electronics & Communication Engineering)
- LE (Leather Engineering)
- URP (Urban & Regional Planning)
- ME (Mechanical Engineering) - *Recently updated*

---

## Future Course Additions

When adding new courses to any department:

1. **Always ensure course code follows pattern:** `[DEPT] XYYZ`
   - X = Year (1-4)
   - Y = Term (1-2)
   - Z = Course number (any digit)

2. **Type will be AUTO-DETECTED:**
   - Last digit even → Automatically Sessional
   - Last digit odd → Automatically Theory

3. **No manual type marking needed:**
   - Let the system handle it
   - The code structure IS the specification

---

**Implemented By:** Curriculum System  
**Reviewed By:** Engineering Department  
**Effective Date:** 2026-05-17  
**Version:** 1.0 (Permanent)
