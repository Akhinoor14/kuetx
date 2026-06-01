/**
 * CT & Quiz Scheduler Core
 * Generates optimized scheduling for CTs and quizzes based on term constraints
 */

/**
 * Get business days between two dates, excluding holidays and weekends
 */
export function getBusinessDays(startDate, endDate, holidays = [], excludeWeekends = true) {
  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  const holidaySet = new Set(
    holidays.map(h => typeof h === 'string' ? h : h.date)
  );

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const isWeekend = excludeWeekends && (current.getDay() === 0 || current.getDay() === 6);
    const isHoliday = holidaySet.has(dateStr);

    if (!isWeekend && !isHoliday) {
      days.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * Calculate instruction days (term minus holidays, opening week, closing week)
 */
export function calculateInstructionDays(termStart, termEnd, holidays = [], skipFirstWeeks = 2, skipLastWeeks = 1) {
  // Calculate week boundaries
  const start = new Date(termStart);
  const end = new Date(termEnd);

  // First N weeks
  const firstWeekEnd = new Date(start);
  firstWeekEnd.setDate(firstWeekEnd.getDate() + skipFirstWeeks * 7);

  // Last N weeks
  const lastWeekStart = new Date(end);
  lastWeekStart.setDate(lastWeekStart.getDate() - skipLastWeeks * 7);

  // Get business days in middle period
  const businessDays = getBusinessDays(firstWeekEnd, lastWeekStart, holidays);
  return businessDays;
}

/**
 * Generate spacing for N CTs across available days
 * Returns recommended dates ensuring minimum gap
 */
export function generateCTDates(availableDays, numCTs, minGapDays = 12) {
  if (!availableDays || availableDays.length === 0) return [];
  if (numCTs === 0) return [];

  const dates = [];
  const step = Math.floor((availableDays.length - 1) / (numCTs + 1));

  for (let i = 1; i <= numCTs; i++) {
    const idx = Math.min(i * step, availableDays.length - 1);
    dates.push(availableDays[idx]);
  }

  // Validate minimum gap
  const warnings = [];
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const gapDays = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
    if (gapDays < minGapDays) {
      warnings.push(`CT gap between ${dates[i - 1]} and ${dates[i]} is ${gapDays} days (min: ${minGapDays})`);
    }
  }

  return { dates, warnings };
}

/**
 * Main scheduler: generates CT & quiz schedule for a course
 */
export function scheduleCourseCTs(options = {}) {
  const {
    courseId,
    courseType = 'theory', // 'theory', 'sessional', 'lab'
    termStart,
    termEnd,
    holidays = [],
    numCTs = 3,
    teachers = [],
    model = 'balanced', // 'balanced', 'distributed', 'teacher-centric'
    minGapDays = 12,
    skipFirstWeeks = 2,
    skipLastWeeks = 1,
    includeQuiz = true,
    quizPlacement = 'middle' // 'early', 'middle', 'late'
  } = options;

  if (!termStart || !termEnd) {
    return { error: 'termStart and termEnd required' };
  }

  // Calculate valid instruction period
  const instructionDays = calculateInstructionDays(termStart, termEnd, holidays, skipFirstWeeks, skipLastWeeks);

  if (instructionDays.length < numCTs * minGapDays) {
    return {
      ctList: [],
      quizList: [],
      warnings: [`Not enough instruction days (${instructionDays.length}) for ${numCTs} CTs with ${minGapDays}d min gap`]
    };
  }

  // Generate CT dates based on model
  let ctDates = [];
  let ctWarnings = [];

  if (model === 'balanced') {
    const result = generateCTDates(instructionDays, numCTs, minGapDays);
    ctDates = result.dates;
    ctWarnings = result.warnings;
  } else if (model === 'distributed') {
    // More conservative spacing
    const result = generateCTDates(instructionDays, numCTs, minGapDays + 5);
    ctDates = result.dates;
    ctWarnings = result.warnings;
  } else if (model === 'teacher-centric') {
    // Assign CTs to specific teacher windows
    const result = assignTeacherCTs(instructionDays, numCTs, teachers, minGapDays);
    ctDates = result.dates;
    ctWarnings = result.warnings;
  }

  // Build CT objects with owner assignment
  const ctList = ctDates.map((date, idx) => {
    let owners = [];
    if (teachers.length >= 2 && idx < 2) {
      owners = [teachers[idx]]; // First 2 CTs: individual teacher
    } else if (teachers.length >= 2) {
      owners = teachers; // Joint CTs: all teachers
    } else if (teachers.length === 1) {
      owners = [teachers[0]];
    }

    return {
      type: `CT${idx + 1}`,
      date,
      owners
    };
  });

  // Generate quiz (if applicable)
  const quizList = [];
  if (includeQuiz && courseType !== 'theory') {
    const quizDate = generateQuizDate(instructionDays, quizPlacement);
    if (quizDate) {
      quizList.push({
        type: courseType === 'lab' ? 'LabQuiz' : 'Sessional Quiz',
        date: quizDate
      });
    }
  }

  return {
    courseId,
    ctList,
    quizList,
    warnings: ctWarnings,
    sourceModel: model
  };
}

/**
 * Assign CTs to teacher-specific windows
 */
function assignTeacherCTs(instructionDays, numCTs, teachers, minGapDays) {
  if (numCTs === 3 && teachers.length >= 2) {
    // Pattern: Teacher A, Teacher B, Joint
    const third = Math.floor(instructionDays.length / 3);
    const twoThird = Math.floor((2 * instructionDays.length) / 3);

    return {
      dates: [instructionDays[third], instructionDays[twoThird], instructionDays[instructionDays.length - 1]],
      warnings: []
    };
  } else if (numCTs === 4 && teachers.length >= 2) {
    // Pattern: A, B, A, B
    const quarter = Math.floor(instructionDays.length / 5);
    return {
      dates: [
        instructionDays[quarter],
        instructionDays[2 * quarter],
        instructionDays[3 * quarter],
        instructionDays[4 * quarter]
      ],
      warnings: []
    };
  }

  // Fallback to balanced
  return generateCTDates(instructionDays, numCTs, minGapDays);
}

/**
 * Generate quiz date based on placement preference
 */
function generateQuizDate(instructionDays, placement = 'middle') {
  if (!instructionDays || instructionDays.length === 0) return null;

  if (placement === 'early') {
    return instructionDays[Math.floor(instructionDays.length * 0.25)];
  } else if (placement === 'middle') {
    return instructionDays[Math.floor(instructionDays.length * 0.5)];
  } else if (placement === 'late') {
    // Lab quizzes: near end but not last week
    return instructionDays[Math.floor(instructionDays.length * 0.8)];
  }
  return instructionDays[Math.floor(instructionDays.length * 0.5)];
}

/**
 * Generate full schedule for all courses in a term
 */
export function generateTermSchedule(options = {}) {
  const {
    term,
    termStart,
    termEnd,
    courses = [],
    holidays = [],
    model = 'balanced'
  } = options;

  const result = {
    term,
    generated_at: new Date().toISOString().split('T')[0],
    courses: []
  };

  for (const course of courses) {
    const scheduled = scheduleCourseCTs({
      courseId: course.courseId,
      courseType: course.type || 'theory',
      termStart,
      termEnd,
      holidays,
      numCTs: course.numCTs || 3,
      teachers: course.teachers || [],
      model,
      includeQuiz: course.type !== 'theory',
      quizPlacement: course.type === 'lab' ? 'late' : 'middle'
    });

    result.courses.push({
      courseId: course.courseId,
      title: course.title,
      type: course.type || 'theory',
      ...scheduled
    });
  }

  return result;
}

/**
 * Validate schedule: check for conflicts, spacing violations, etc.
 */
export function validateSchedule(schedule, constraints = {}) {
  const {
    minGapDays = 12,
    noCtFirstWeeks = 2,
    noCtLastWeeks = 1
  } = constraints;

  const issues = [];

  for (const course of schedule.courses) {
    // Check CT spacing
    if (course.ctList && course.ctList.length > 1) {
      for (let i = 1; i < course.ctList.length; i++) {
        const prev = new Date(course.ctList[i - 1].date);
        const curr = new Date(course.ctList[i].date);
        const gapDays = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));

        if (gapDays < minGapDays) {
          issues.push({
            type: 'spacing-violation',
            courseId: course.courseId,
            message: `${course.courseId}: Gap of ${gapDays} days (min: ${minGapDays}) between ${course.ctList[i - 1].type} and ${course.ctList[i].type}`
          });
        }
      }
    }

    // Merge warnings
    if (course.warnings && course.warnings.length > 0) {
      issues.push(...course.warnings.map(w => ({ courseId: course.courseId, message: w, type: 'warning' })));
    }
  }

  return issues;
}
