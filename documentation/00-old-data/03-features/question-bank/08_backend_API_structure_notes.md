/**
 * Question Bank Backend Structure & API
 * This file outlines the backend implementation needed for Question Bank feature
 */

// ============================================
// DATABASE SCHEMA (MongoDB/Firebase Example)
// ============================================

/**
 * Collection: QuestionSets
 * Stores all question papers for different courses/terms
 */
const QuestionSetSchema = {
  _id: ObjectId,
  courseId: String, // Reference to course
  courseCode: String, // EEE 101
  courseName: String, // Circuit Theory - I
  year: Number, // 1-4
  term: Number, // 1-2
  termLabel: String, // Y1 Term 1 2024
  examType: String, // Final, Midterm, Quiz
  questionCount: Number,
  uploadedBy: String, // Admin ID
  uploadedDate: Date,
  lastModified: Date,
  
  status: String, // available, coming_soon, archived
  
  // File references
  pdfFileId: String, // Firebase Storage ID
  pdfUrl: String, // Signed URL (expires)
  fileSize: Number, // in bytes
  
  // Solutions
  solutionStatus: String, // not_started, in_progress, available
  solutionProgress: Number, // 0-100
  solutionData: {
    solutions: [{
      questionNumber: Number,
      answer: String,
      explanation: String,
      difficulty: String, // easy, medium, hard
      topic: String,
    }],
    lastUpdatedBy: String,
    lastUpdatedDate: Date,
  },
  
  // Analytics
  downloadCount: Number,
  viewCount: Number,
  rating: {
    average: Number,
    count: Number,
  },
  
  // Metadata
  tags: [String],
  keywords: [String],
  difficulty: String, // easy, medium, hard
  isVerified: Boolean,
};

/**
 * Collection: Contributions
 * Tracks user contributions to Question Bank
 */
const ContributionSchema = {
  _id: ObjectId,
  submittedBy: String, // User email or ID
  submittedDate: Date,
  status: String, // pending, approved, rejected
  
  courseCode: String,
  courseName: String,
  year: Number,
  term: Number,
  examType: String,
  questionCount: Number,
  
  fileId: String, // Temporary file storage
  notes: String,
  
  // Admin review
  reviewedBy: String,
  reviewedDate: Date,
  reviewNotes: String,
};

/**
 * Collection: UserDownloads (Analytics)
 * Track what users download for insights
 */
const UserDownloadSchema = {
  _id: ObjectId,
  userId: String,
  questionSetId: String,
  downloadedDate: Date,
  downloadType: String, // term, course, single
  ipAddress: String,
};

// ============================================
// REST API ENDPOINTS
// ============================================

/**
 * GET /api/question-bank
 * Get all question sets (with filters)
 * Query params: year, term, courseCode, status, solutionStatus, search
 */
GET_ENDPOINT_ALL = {
  request: {
    query: {
      year: Number, // optional
      term: Number, // optional
      courseCode: String, // optional
      status: 'available' | 'coming_soon', // optional
      solutionStatus: 'available' | 'in_progress' | 'not_started', // optional
      search: String, // optional search term
      limit: Number, // default 50
      skip: Number, // for pagination
    }
  },
  response: {
    success: Boolean,
    data: [QuestionSetSchema],
    total: Number,
    timestamp: Date,
  }
};

/**
 * GET /api/question-bank/:id
 * Get single question set details
 */
GET_ENDPOINT_SINGLE = {
  request: {
    params: {
      id: String, // QuestionSet ID
    }
  },
  response: {
    success: Boolean,
    data: QuestionSetSchema,
    timestamp: Date,
  }
};

/**
 * POST /api/question-bank/download/term
 * Download all questions for a specific term
 * Returns: ZIP file or presigned URL
 */
POST_DOWNLOAD_TERM = {
  request: {
    body: {
      year: Number,
      term: Number,
    }
  },
  response: {
    success: Boolean,
    downloadUrl: String, // Presigned URL (expires in 1 hour)
    filename: String, // Y1_Term1_Questions.zip
    size: Number,
    message: String,
  }
};

/**
 * POST /api/question-bank/download/course
 * Download questions for specific course in a term
 * Returns: ZIP file
 */
POST_DOWNLOAD_COURSE = {
  request: {
    body: {
      courseId: String,
      year: Number,
      term: Number,
    }
  },
  response: {
    success: Boolean,
    downloadUrl: String,
    filename: String, // EEE101_Y1T1_Questions.zip
    size: Number,
  }
};

/**
 * POST /api/question-bank/contribution
 * Submit a new question contribution
 * Form data with file upload
 */
POST_CONTRIBUTION = {
  request: {
    method: 'POST',
    contentType: 'multipart/form-data',
    body: {
      courseCode: String, // required
      courseName: String, // required
      year: Number, // required (1-4)
      term: Number, // required (1-2)
      examType: String, // required (Final, Midterm, Quiz)
      questionCount: Number, // required
      file: File, // PDF file, required
      notes: String, // optional
      hasSolutions: Boolean, // optional
      solutionFile: File, // optional
      email: String, // optional, for credit
    }
  },
  response: {
    success: Boolean,
    message: String,
    contributionId: String,
    status: 'pending_review',
  }
};

/**
 * GET /api/question-bank/stats
 * Get database statistics
 */
GET_STATS = {
  request: {},
  response: {
    success: Boolean,
    data: {
      totalQuestionSets: Number,
      availableSets: Number,
      totalQuestions: Number,
      coursesCovered: Number,
      solutionsAvailable: Number,
      completionPercentage: Number,
      lastUpdated: Date,
    }
  }
};

/**
 * GET /api/question-bank/check/:courseId/:year/:term
 * Quick check if questions exist for specific course/term
 * Useful for showing badges in Course page
 */
GET_CHECK_AVAILABILITY = {
  request: {
    params: {
      courseId: String,
      year: Number,
      term: Number,
    }
  },
  response: {
    success: Boolean,
    available: Boolean,
    questionCount: Number, // if available
    solutionStatus: String,
  }
};

/**
 * POST /api/question-bank/:id/rating
 * User rates a question set
 */
POST_RATING = {
  request: {
    body: {
      rating: Number, // 1-5
      comment: String, // optional
    }
  },
  response: {
    success: Boolean,
    averageRating: Number,
    totalRatings: Number,
  }
};

// ============================================
// FRONTEND-BACKEND INTEGRATION FLOW
// ============================================

/**
 * 1. ON APP LOAD
 * - Fetch question bank data and cache locally
 * - GET /api/question-bank/stats
 */

/**
 * 2. ON QUESTION BANK PAGE LOAD
 * - GET /api/question-bank (with filters)
 * - Display filtered results
 */

/**
 * 3. ON DOWNLOAD CLICK
 * - POST /api/question-bank/download/term or /course
 * - Show download progress modal
 * - Log download in analytics
 */

/**
 * 4. ON COURSE PAGE
 * - GET /api/question-bank/check/:courseId/:year/:term
 * - Show "Questions Available" badge if true
 */

/**
 * 5. ON CONTRIBUTION FORM SUBMIT
 * - POST /api/question-bank/contribution
 * - Show success message
 * - Redirect to Question Bank page
 */

// ============================================
// FILE STORAGE (Firebase or Cloud Storage)
// ============================================

/**
 * Storage Structure:
 * /question-bank/
 *   /questions/
 *     /Y1/T1/EEE101_Final_2024.pdf
 *     /Y1/T1/EEE102_Midterm_2024.pdf
 *   /solutions/
 *     /Y1/T1/EEE101_Solutions.json
 *   /contributions/
 *     /pending/contribution_ID_filename.pdf
 * 
 * Files expire after:
 * - Pending: 30 days
 * - Approved: Never (archived storage)
 */

// ============================================
// ADMIN FUNCTIONS (Separate Dashboard)
// ============================================

/**
 * ADMIN: Review contributions
 * PUT /api/admin/contribution/:id
 * body: { status: 'approved'|'rejected', notes: String }
 */

/**
 * ADMIN: Add solutions
 * PUT /api/question-bank/:id/solutions
 * body: { solutionData: Object, progress: Number }
 */

/**
 * ADMIN: Update solution progress
 * PATCH /api/question-bank/:id/solution-progress
 * body: { progress: Number (0-100) }
 */

/**
 * ADMIN: Archive question set
 * PATCH /api/question-bank/:id/archive
 */

// ============================================
// CACHING STRATEGY
// ============================================

/**
 * Frontend Caching (localStorage):
 * - Cache question bank list for 1 hour
 * - Cache individual question details indefinitely
 * - Invalidate on: new upload, solution update, status change
 * 
 * Backend Caching (Redis):
 * - Cache stats for 30 minutes
 * - Cache question bank list for 1 hour
 * - Pre-generate ZIP files for popular terms
 */

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Common Error Responses:
 * 
 * 404: Questions not in our database
 * 400: Invalid parameters
 * 409: File already exists
 * 413: File too large (limit: 50MB)
 * 429: Rate limited
 * 500: Server error
 */

export const questionBankAPI = {
  // Endpoints list for easy reference
  endpoints: {
    getAllQuestions: 'GET /api/question-bank',
    getQuestionById: 'GET /api/question-bank/:id',
    downloadTermQuestions: 'POST /api/question-bank/download/term',
    downloadCourseQuestions: 'POST /api/question-bank/download/course',
    submitContribution: 'POST /api/question-bank/contribution',
    getStats: 'GET /api/question-bank/stats',
    checkAvailability: 'GET /api/question-bank/check/:courseId/:year/:term',
    rateQuestionSet: 'POST /api/question-bank/:id/rating',
  }
};
