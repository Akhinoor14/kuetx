// Question Bank Data Models & Store
// This file contains the structure and helper functions for Question Bank management

export const QUESTION_BANK_MODELS = {
  // Question Set Model
  QuestionSet: {
    id: 'string (uid)', // Unique identifier
    courseId: 'string', // Reference to course
    courseCode: 'string', // EEE 101
    courseName: 'string', // Circuit Theory - I
    year: 'number (1-4)', // Academic year
    term: 'number (1-2)', // Term in that year
    termLabel: 'string', // Y1 Term 1 2024
    examType: 'string', // Final, Midterm, Quiz, etc.
    questionCount: 'number', // Total number of questions
    uploadedDate: 'ISO string', // When it was added
    downloadCount: 'number', // Track popularity
    status: '"available" | "coming_soon" | "archived"',
    pdfFile: 'string', // PDF file path or base64
    solutionStatus: '"not_started" | "in_progress" | "available"',
    solutionProgress: 'number (0-100)', // For in_progress
    solutionData: 'JSON object', // Actual solution content
    downloadUrl: 'string', // ZIP file path
    createdBy: 'string', // Admin username
    tags: 'array of strings', // For categorization
  },

  // Solution Model (nested in QuestionSet.solutionData)
  Solution: {
    questionsWithSolutions: 'array',
    // [{
    //   questionNum: number,
    //   question: string,
    //   answer: string,
    //   explanation: string,
    //   difficulty: "easy" | "medium" | "hard",
    //   topic: string
    // }]
    lastUpdatedBy: 'string',
    lastUpdatedDate: 'ISO string',
    completionPercentage: 'number',
  }
};

// Helper functions for Question Bank
export const questionBankHelpers = {
  /**
   * Get all questions for a specific term
   */
  getTermQuestions: (allQuestions, year, term) => {
    return allQuestions.filter(q => q.year === year && q.term === term);
  },

  /**
   * Get all questions for a specific course in a term
   */
  getCourseTermQuestions: (allQuestions, courseId, year, term) => {
    return allQuestions.filter(q => q.courseId === courseId && q.year === year && q.term === term);
  },

  /**
   * Get all unique courses in question bank
   */
  getUniqueCourses: (allQuestions) => {
    const courses = new Map();
    allQuestions.forEach(q => {
      if (!courses.has(q.courseId)) {
        courses.set(q.courseId, {
          courseId: q.courseId,
          courseCode: q.courseCode,
          courseName: q.courseName,
          setCount: 0,
        });
      }
      courses.get(q.courseId).setCount++;
    });
    return Array.from(courses.values());
  },

  /**
   * Check if questions available for course in specific term
   */
  hasQuestionsForCourseTerm: (allQuestions, courseId, year, term) => {
    return allQuestions.some(q => q.courseId === courseId && q.year === year && q.term === term);
  },

  /**
   * Get solution stats
   */
  getSolutionStats: (allQuestions) => {
    return {
      total: allQuestions.length,
      available: allQuestions.filter(q => q.solutionStatus === 'available').length,
      inProgress: allQuestions.filter(q => q.solutionStatus === 'in_progress').length,
      notStarted: allQuestions.filter(q => q.solutionStatus === 'not_started').length,
      completionPercentage: Math.round(
        (allQuestions.filter(q => q.solutionStatus === 'available').length / allQuestions.length) * 100
      ),
    };
  },

  /**
   * Download questions as ZIP
   * Note: Backend will handle actual ZIP creation
   */
  prepareDownloadPayload: (questions, type = 'term') => {
    return {
      questions: questions.map(q => ({
        id: q.id,
        courseCode: q.courseCode,
        examType: q.examType,
        pdfFile: q.pdfFile,
      })),
      type, // 'term' or 'course'
      timestamp: new Date().toISOString(),
    };
  },
};

// Store integration
export const initQuestionBankStore = () => {
  // Initialize or load from localStorage
  const stored = localStorage.getItem('questionBank_data');
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
};

export const saveQuestionBankStore = (data) => {
  localStorage.setItem('questionBank_data', JSON.stringify(data));
};
