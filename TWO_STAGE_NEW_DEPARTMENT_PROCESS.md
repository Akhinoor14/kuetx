# নতুন Department যোগ করার প্রক্রিয়া
## Two-Stage Process: Skeleton → Details

---

## 📋 STAGE 1: Term Folder Skeleton তৈরি (শুরুতে)

**আপনি দেবেন:** শুধু কোর্স তালিকা, যাতে `terms/` folder এর JS files বানানো যায়
```
Y1T1: Ch 2101 (3), Ch 2102 (0.75), Math 2101 (3), EE 2101 (3), EE 2102 (1.5)
Y1T2: Physics 2101 (3), Physics 2102 (0.75), Material 2101 (3)
Y2T1: Thermo 2101 (3), Thermo 2102 (1.5), Mechanics 2101 (3)
... (সব 8 টার্মের জন্য)
```

**আমরা করব:**
```bash
node scripts/generate-[DEPT]-skeleton.cjs
```

**ফলাফল:**
```
✓ Folder structure তৈরি
✓ সব নেক্সেসারি files তৈরি
✓ `terms/` folder এর Y1T1-Y4T2 তৈরি (code + credit সহ)
✓ meta.js, notes.js, optional.js setup
✓ Status: SKELETON READY ✓
```

**সময়:** 2-3 মিনিট

---

## 📚 STAGE 2: Syllabus Folder Details পূর্ণ করা (Later)

**আপনি দেবেন:** সম্পূর্ণ syllabus JSON, যাতে `syllabus/` folder populate করা যায়
```json
{
  "department": "TE",
  "terms": {
    "Y1T1": {
      "courses": {
        "Ch 2101": {
          "title": "Chemistry I",
          "credit": 3,
          "contactHour": "3 hrs/week",
          "topics": [
            "Topic 1 detail",
            "Topic 2 detail",
            "Topic 3 detail"
          ],
          "references": ["ref1", "ref2"]
        },
        "Ch 2102": {
          "title": "Chemistry Lab",
          "credit": 0.75,
          "topics": [],
          "sessionalNote": "Lab based on Ch 2101"
        }
      }
    },
    "Y1T2": {
      // ... এভাবে সব টার্মের জন্য
    }
  }
}
```

**আমরা করব:**
```bash
# 1. Save করবো: sylla/TEcurriculum.json

# 2. Run script:
node scripts/populate-TE-json-to-js.cjs

# 3. Verify করবো:
node scripts/verify-all-departments.cjs

# 4. Register করবো:
# Update src/data/curriculum/departments/index.js
# Add: import { TE_DEPARTMENT as TE } from './TE/index.js';
```

**ফলাফল:**
```
✓ সব Y1T1-Y4T2 files populated
✓ Topics populated
✓ References added
✓ `syllabus/` folder fully populated
✓ System এ registered
✓ CURRICULUM.departments.TE accessible
✓ Status: FULLY INTEGRATED ✓
```

**সময়:** 3-4 মিনিট (সব কিছু automated)

---

## 🔄 Process Timeline

### Day 1 (Morning):
```
You: "এখানে TE এর course list"
Me: Run skeleton script
Result: TE folder structure ready ✓
Status: Waiting for detailed curriculum
```

### Day 1/2/Later (যখন আছে):
```
You: "এখানে detailed curriculum JSON"
Me: 
  1. Save to sylla/TEcurriculum.json
  2. Run populate script
  3. Verify
  4. Register in system
Result: TE fully operational ✓
Access: CURRICULUM.departments.TE
```

---

## ⏱️ Time Breakdown

| Step | Time | Who Does | Status |
|------|------|----------|--------|
| **STAGE 1** |
| Course list provided | 5-10 min | User | Input |
| Generate skeleton | 2 min | Script | Automatic |
| | **~15 min total** | | ✓ Skeleton ready |
| **STAGE 2 (Later)** |
| Detailed curriculum provided | 10 min | User | Input |
| Populate + Verify | 3 min | Script | Automatic |
| Register in system | 1 min | Me | Manual |
| | **~14 min total** | | ✓ Fully ready |
| **GRAND TOTAL** | **~30 min** | Mixed | ✓ Production ready |

---

## 📊 Skeleton vs Populated

### Skeleton Structure (STAGE 1):
```javascript
export const TE_SYLLABUS_Y1T1 = {
  termKey: 'Y1T1',
  title: 'First Year First Term',
  courses: {
    'Ch 2101': {
      title: '',  // Placeholder (from your list)
      credit: 3,
      contactHour: '',
      topics: [],  // EMPTY - waiting for details
      sessionalNote: null,
      references: []  // EMPTY
    },
    'Ch 2102': {
      title: '',
      credit: 0.75,
      contactHour: '',
      topics: [],  // EMPTY
      sessionalNote: null,
      references: []  // EMPTY
    }
  }
};
```

### Fully Populated (STAGE 2):
```javascript
export const TE_SYLLABUS_Y1T1 = {
  termKey: 'Y1T1',
  title: 'First Year First Term',
  courses: {
    'Ch 2101': {
      title: 'Chemistry I',  // ✓ Filled
      credit: 3,
      contactHour: '3 hrs/week',  // ✓ Filled
      topics: [  // ✓ POPULATED
        'Chemical Equilibrium',
        'Electro-Chemistry',
        'Nuclear Chemistry',
        'Polymer Chemistry'
      ],
      sessionalNote: null,
      references: [  // ✓ POPULATED
        'Atkins Physical Chemistry',
        'Levine Quantum Chemistry'
      ]
    },
    'Ch 2102': {
      title: 'Chemistry Lab',
      credit: 0.75,
      contactHour: '3 hrs/week',
      topics: [],  // Expected to be empty for sessional
      sessionalNote: 'Laboratory based on Ch 2101',  // ✓ Filled
      references: []
    }
  }
};
```

---

## 📝 কি দিতে হবে (Course List Format)

শুধু এই ফরম্যাটে:
```
Y1T1: [Code] (Credit), [Code] (Credit), [Code] (Credit)
Y1T2: [Code] (Credit), [Code] (Credit)
Y2T1: ...
... (8 টার্ম)

Example:
Y1T1: Ch 2101 (3), Ch 2102 (0.75), Math 2101 (3), EE 2101 (3), EE 2102 (1.5), MTE 2101 (3), MTE 2102 (0.75), MTE 2100 (1.5)
Y1T2: Physics 2101 (3), Physics 2102 (0.75), Material 2101 (3), Hum 2101 (3), Comp 2101 (1.5), Thermal 2101 (3), Thermal 2102 (1.5)
```

**Or better yet:** Send as spreadsheet/table format

---

## ✅ Ready to Use

এই process follow করলে:
- ✓ 30 মিনিট এ নতুন department ready
- ✓ সব 6 existing departments এর মতো काম করবে
- ✓ CURRICULUM.departments.[DEPT] দিয়ে access হবে
- ✓ সব React components এ use করা যাবে

---

**Process Saved:** `/memories/repo/DEPARTMENT_IMPLEMENTATION_PATTERN.md`  
**Ready for:** Next new department whenever you have data!
