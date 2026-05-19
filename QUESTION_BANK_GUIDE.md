# Question Bank Feature - Complete Implementation Guide

## 📋 Overview
The Question Bank is a centralized database for past exam questions organized by course, year, and term. It allows students to download questions as ZIP files and access solutions.

---

## ✅ Completed Tasks

### 1. Navigation Update ✅
- Updated `src/nav.js`
- Changed from "Term Question & Solution" → **"Question Bank"**
- Icon: `BookMarked`
- Path: `/question-bank`

### 2. Page Creation ✅
- Created `src/pages/QuestionBank.jsx` with:
  - **Hero section** with stats (Question Sets, Available, Solutions, Courses)
  - **Search functionality** across course codes and names
  - **Filter options**: Year, Term, Solution Status
  - **View modes**: Current Term vs All Terms
  - **Download buttons**: Term-wide or Course-specific
  - **Solutions progress** with in-progress indicator (60%)
  - **Help & Contribute** section with Google Form link
  - **Modal system** for notifications (success, error, help)

### 3. Routing Update ✅
- Updated `src/App.jsx`
- Added import: `import QuestionBank from './pages/QuestionBank';`
- Added route: `<Route path="/question-bank" element={<QuestionBank />} />`

### 4. Data Models ✅
- Created `src/store/questionBankModels.js`
- Defined `QuestionSet` schema with all fields
- Created helper functions:
  - `getTermQuestions()` - Get questions for specific term
  - `getCourseTermQuestions()` - Get course-specific questions
  - `hasQuestionsForCourseTerm()` - Check availability
  - `getSolutionStats()` - Calculate statistics
  - `prepareDownloadPayload()` - Format for download

### 5. Backend API Structure ✅
- Created `src/data/questionBankAPI.md`
- Documented all endpoints:
  - GET questions with filters
  - Download term/course questions
  - Submit contributions
  - Get statistics
  - Check availability

### 6. Styling & CSS ✅
- Created `src/styles/questionBank.css`
- Included animations: pulse, slideInDown, fadeIn
- Responsive design for mobile/tablet
- Dark mode support
- Print styles

### 7. Sample Data ✅
- Built-in sample questions (3 sets):
  - EEE 101 (Circuit Theory) - Y1T1 Final - Available
  - EEE 102 (Digital Logic) - Y1T1 Midterm - In Progress (60%)
  - EEE 101 - Y1T2 Final - Coming Soon
- Ready for backend integration

---

## 🔄 Integration Points

### Course Page Integration (To Do)
The Course page should show a **label chip** indicating if questions are available:

```jsx
// Add to Course details section:
import { questionBankHelpers } from '../store/questionBankModels';

const questionBank = store.get('questionBank') || [];
const hasQuestions = questionBankHelpers.hasQuestionsForCourseTerm(
  questionBank, 
  courseId, 
  currentYear, 
  currentTerm
);

{hasQuestions && (
  <button
    onClick={() => downloadCourseQuestions(courseId, currentYear, currentTerm)}
    style={{...buttonStyles...}}
  >
    📚 Questions Available
  </button>
)}
```

**File to modify**: `src/pages/Courses.jsx`
**Location**: In course detail view
**See**: `/memories/session/course_page_integration.md`

---

## 📦 Sample Data Structure

```javascript
{
  id: '1',
  courseId: 'eee101',
  courseCode: 'EEE 101',
  courseName: 'Circuit Theory - I',
  year: 1,
  term: 1,
  termLabel: 'Y1 Term 1 2024',
  examType: 'Final',
  questionCount: 15,
  status: 'available',
  solutionStatus: 'available' | 'in_progress' | 'not_started',
  solutionProgress: 100, // 0-100 for in_progress
  downloadUrl: '/files/eee101_y1t1_final_2024.zip'
}
```

---

## 🎯 Key Features

### 1. Download System
- **Term Download**: All questions for a year/term → ZIP
- **Course Download**: Only specific course → ZIP
- Validates if questions exist before download
- Shows progress modal during download
- Success/error notifications

### 2. Filter System
- **Year Filter**: Y1, Y2, Y3, Y4, or All
- **Term Filter**: Term 1, Term 2, or All
- **Solution Status**: Available, In Progress, Coming Soon, or All
- **Search**: By course code or name
- **View Mode**: Current Term vs All Terms

### 3. Statistics Dashboard
- Total Question Sets
- Available Sets
- Solutions Available
- Courses Covered

### 4. Help & Contribution
- **Help Modal**: Step-by-step guide for contributing
- **Google Form Link**: https://forms.gle/9NahxuzSeeU6NTLw6
- Explains how to gather and submit materials
- Link opens in new tab

### 5. Solution Progress Tracking
- Shows % complete (e.g., 60%)
- Visual progress bar with animation
- Status labels: "Available", "In Progress", "Coming Soon"

---

## 🔗 Google Form URL
Contributions form for users: **https://forms.gle/9NahxuzSeeU6NTLw6**

Form collects:
- Course code and name
- Year and term
- Exam type
- Number of questions
- Question file upload
- Solution file (optional)

---

## 💾 Data Storage

### Frontend (localStorage)
```javascript
store.set('questionBank', [...questions]);
store.get('questionBank'); // Returns array
```

### Sample Query
```javascript
const questions = store.get('questionBank') || [];
const y1t1 = questions.filter(q => q.year === 1 && q.term === 1);
const eee101 = questions.find(q => q.courseId === 'eee101');
```

---

## 🚀 Backend Implementation (Next Steps)

### 1. Database
- Create `QuestionSets` collection
- Create `Contributions` collection for tracking uploads
- Create `UserDownloads` for analytics

### 2. API Endpoints
- `GET /api/question-bank` - List all
- `POST /api/question-bank/download/term` - Download term questions
- `POST /api/question-bank/download/course` - Download course questions
- `POST /api/question-bank/contribution` - Submit contribution
- `GET /api/question-bank/check/:courseId/:year/:term` - Check availability

### 3. File Storage
- Firebase Storage or AWS S3
- Path structure: `/question-bank/questions/Y1/T1/EEE101.pdf`
- Solution JSON: `/question-bank/solutions/Y1/T1/EEE101.json`

### 4. Admin Dashboard
- Review and approve contributions
- Add solutions to question sets
- Update solution progress percentage
- Manage question set status

---

## 📱 File Structure

```
src/
├── pages/
│   └── QuestionBank.jsx (Main page component)
├── store/
│   └── questionBankModels.js (Data models & helpers)
├── styles/
│   └── questionBank.css (Optional styling file)
├── data/
│   └── questionBankAPI.md (API documentation)
├── nav.js (Updated navigation config)
└── App.jsx (Updated routing)
```

---

## 🎨 UI Components

### 1. Hero Section
- Title: "Question Bank"
- Subtitle: Description
- Stats cards (4 metrics)
- "Help Contribute" button

### 2. Search & Filters
- Search input for course name/code
- Year dropdown
- Term dropdown
- Solution status dropdown
- View mode toggle (Current Term / All Terms)

### 3. Question Cards
- Course badge
- Term label badge
- Exam type badge
- Solution status (with progress)
- Two download buttons (Term & Course)
- Delete button (admin only)

### 4. Help Modal
- Step 1: Gather materials
- Step 2: Fill form
- Step 3: We process it
- Pro tip about solutions
- Link to form

### 5. Download Modal
- Downloading state with progress
- Success state with message
- Error state with "Contribute" button

---

## 🔐 Access Control

### Current Implementation
- All students: Can view & download
- Admin: Can manage (future)

### Future
- Separate admin dashboard
- Contribution approval workflow
- Role-based access

---

## 📊 Analytics Tracking (Optional)

```javascript
// Log download
{
  userId: user.id,
  questionSetId: set.id,
  downloadedDate: new Date(),
  downloadType: 'term' | 'course',
  courseId: course.id // if course download
}
```

---

## 🧪 Testing Checklist

- [ ] Page loads without errors
- [ ] Filters work correctly
- [ ] Search finds courses by code and name
- [ ] Download buttons trigger modals
- [ ] Help button opens modal with steps
- [ ] "Help Contribute" opens Google Form in new tab
- [ ] Solution progress shows percentage (60%)
- [ ] Sample data displays correctly
- [ ] Responsive on mobile/tablet
- [ ] Modal closes when clicking outside (future enhancement)

---

## 📝 Notes

1. **Sample data included**: 3 question sets built into component
2. **Google Form link**: Embedded and opens in new tab
3. **localStorage ready**: Data persists across sessions
4. **Mobile responsive**: All styles adapt to screen size
5. **No backend required yet**: Works with local data for demo

---

## 🎯 Next Immediate Tasks

1. **Course Page Integration**: Add question availability chip to course cards
2. **Admin Dashboard**: Create for managing contributions and solutions
3. **Backend API**: Implement endpoints for download and contribution
4. **File Storage**: Set up cloud storage for PDFs and ZIPs
5. **Email notifications**: Notify when solutions are added

---

## 📞 Support

For questions or issues with the Question Bank feature:
1. Check the help modal in the app
2. Review this implementation guide
3. Check sample data structure
4. Review API documentation

---

**Created**: May 19, 2026  
**Status**: ✅ Frontend Complete, ⏳ Backend Ready for Implementation  
**Contributors**: AI Assistant + Development Team
