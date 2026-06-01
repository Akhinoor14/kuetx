/**
 * CT & Quiz Smart Scheduler
 * Generates optimized schedules with multiple models and smart recommendations
 */

import { generateCTDates, calculateInstructionDays, getTermHolidays } from './ctQuizStore';

// Scheduling Models
export const SCHEDULING_MODELS = {
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'Evenly spaced across term for consistent workload',
    icon: 'Scale',
  },
  distributed: {
    id: 'distributed',
    label: 'Distributed',
    description: 'Maximum spacing for low pressure planning',
    icon: 'Maximize',
  },
  teacherCentric: {
    id: 'teacher-centric',
    label: 'Teacher-Centric',
    description: 'Aligned with typical teacher availability patterns',
    icon: 'Users',
  },
  compact: {
    id: 'compact',
    label: 'Compact',
    description: 'Concentrated in middle period, quick coverage',
    icon: 'Minimize',
  },
  lowPressure: {
    id: 'low-pressure',
    label: 'Low Pressure',
    description: 'Generous spacing with extended gaps',
    icon: 'Wind',
  },
};

/**
 * Calculate pressure score (0-100)
 * Based on spacing, timing, and frequency
 */
export function calculatePressureScore(dates, totalDays = 120) {
  if (!dates || dates.length === 0) return 0;
  if (dates.length === 1) return 25;

  // Calculate average gap
  const gaps = [];
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const gap = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
    gaps.push(gap);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);
  const variance = Math.max(...gaps) - Math.min(...gaps);

  // Scoring logic
  let score = 50; // Base 50

  // Penalize small gaps (increase pressure)
  if (minGap < 10) score += 20;
  else if (minGap < 14) score += 10;

  // Reward large gaps (decrease pressure)
  if (avgGap > 20) score -= 15;
  else if (avgGap > 17) score -= 10;

  // Penalize high variance (uneven spacing increases pressure)
  if (variance > 15) score += 10;

  // Penalize late-term concentration
  const lastThird = dates.filter(d => {
    const dDate = new Date(d);
    const daysFromStart = Math.floor((dDate - new Date(dates[0])) / (1000 * 60 * 60 * 24));
    return daysFromStart > totalDays * 0.67;
  });
  if (lastThird.length > dates.length * 0.5) score += 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * Schedule CTs for a course
 */
export function scheduleCourseCTs(options = {}) {
  const {
    courseId,
    courseName = '',
    courseType = 'theory', // 'theory' or 'sessional'
    credits = 3,
    termStartDate,
    termEndDate,
    holidays = [],
    numCTs = 3,
    teachers = ['Teacher 1', 'Teacher 2'],
    model = 'balanced',
    skipFirstWeeks = 2,
    skipLastWeeks = 1,
  } = options;

  try {
    // Calculate available instruction days
    const availableDays = calculateInstructionDays(
      termStartDate,
      termEndDate,
      holidays,
      skipFirstWeeks,
      skipLastWeeks
    );

    if (availableDays.length === 0) {
      return {
        success: false,
        error: 'No available instruction days',
        courseId,
        warnings: ['Cannot schedule: insufficient instruction days'],
      };
    }

    // Generate CT dates based on model
    let ctDates = [];
    let minGap = 12;

    switch (model) {
      case 'distributed':
        minGap = 16;
        break;
      case 'low-pressure':
        minGap = 18;
        break;
      case 'compact':
        minGap = 8;
        break;
      case 'teacher-centric':
        minGap = 12;
        break;
      default:
        minGap = 12;
    }

    const { dates, warnings } = generateCTDates(availableDays, numCTs, minGap);
    ctDates = dates;

    // Assign CTs to teachers
    const ctTeacherMap = {};
    if (courseType === 'theory') {
      // Theory: distribute across teachers
      teachers.slice(0, 2).forEach((teacher, idx) => {
        const assignedCTs = ctDates.filter((_, i) => i % Math.max(1, teachers.length) === idx);
        assignedCTs.forEach(date => {
          ctTeacherMap[date] = teacher;
        });
      });

      // If we have 3+ CTs and only 1 teacher, assign combined CT to primary
      if (ctDates.length >= 3 && teachers.length === 1) {
        ctTeacherMap[ctDates[Math.floor(ctDates.length / 2)]] = 'Combined/All Teachers';
      }
    } else {
      // Sessional/Lab: quiz usually near end
      ctTeacherMap[ctDates[0]] = teachers[0] || 'Lab Instructor';
    }

    const pressure = calculatePressureScore(ctDates);

    return {
      success: true,
      courseId,
      courseName,
      courseType,
      credits,
      numCTs,
      ctDates,
      ctTeacherMap,
      teachers,
      model,
      pressure,
      warnings: warnings || [],
      generatedAt: new Date().toISOString().split('T')[0],
    };
  } catch (error) {
    console.error('[ctQuizScheduler] Error scheduling:', error);
    return {
      success: false,
      courseId,
      error: error.message,
      warnings: ['Error during scheduling'],
    };
  }
}

/**
 * Generate multiple scheduling models for comparison
 */
export function generateMultipleModels(options = {}) {
  const models = ['balanced', 'distributed', 'low-pressure', 'compact'];
  const results = [];

  for (const model of models) {
    const result = scheduleCourseCTs({
      ...options,
      model,
    });
    if (result.success) {
      results.push(result);
    }
  }

  // Sort by pressure (ascending = less pressure first)
  results.sort((a, b) => a.pressure - b.pressure);

  return results;
}

/**
 * Get smart recommendations for a term
 */
export function getSmartRecommendations(courses = [], termInfo = {}) {
  try {
    const recommendations = [];

    // Check for pressure balance
    let avgPressure = 0;
    if (courses.length > 0) {
      const pressures = courses
        .filter(c => c.pressure !== undefined)
        .map(c => c.pressure);
      avgPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length;
    }

    if (avgPressure > 65) {
      recommendations.push({
        type: 'pressure-warning',
        severity: 'high',
        message: 'High average pressure detected. Consider spreading CTs further apart.',
        action: 'Switch to distributed or low-pressure model',
      });
    } else if (avgPressure > 50) {
      recommendations.push({
        type: 'pressure-info',
        severity: 'medium',
        message: 'Moderate pressure level. Current schedule is reasonable.',
        action: null,
      });
    }

    // Check for CT conflicts
    const allDates = {};
    courses.forEach(course => {
      (course.ctDates || []).forEach(date => {
        if (!allDates[date]) allDates[date] = [];
        allDates[date].push(course.courseId);
      });
    });

    const conflictDates = Object.entries(allDates)
      .filter(([, courseIds]) => courseIds.length > 2)
      .map(([date]) => date);

    if (conflictDates.length > 0) {
      recommendations.push({
        type: 'conflict-warning',
        severity: 'high',
        message: `${conflictDates.length} date(s) have 3+ CTs scheduled. Consider rescheduling.`,
        action: 'Manually adjust conflicting dates',
      });
    }

    // Check for early-term coverage
    if (courses.length > 0 && termInfo?.termStartDate) {
      const termStart = new Date(termInfo.termStartDate);
      const week4 = new Date(termStart);
      week4.setDate(week4.getDate() + 14); // 2 weeks

      const earlyTests = courses.filter(c =>
        (c.ctDates || []).some(d => new Date(d) <= week4)
      ).length;

      if (earlyTests === 0) {
        recommendations.push({
          type: 'info',
          severity: 'low',
          message: 'No CTs scheduled in first 2 weeks - this is correct per guidelines.',
          action: null,
        });
      }
    }

    return recommendations;
  } catch (e) {
    console.error('[ctQuizScheduler] Error generating recommendations:', e);
    return [];
  }
}

/**
 * Validate a schedule
 */
export function validateSchedule(courses = [], termInfo = {}) {
  const issues = [];

  // Check for overlapping CTs
  const dateCount = {};
  courses.forEach(course => {
    (course.ctDates || []).forEach(date => {
      dateCount[date] = (dateCount[date] || 0) + 1;
    });
  });

  Object.entries(dateCount).forEach(([date, count]) => {
    if (count > 2) {
      issues.push({
        severity: 'warning',
        message: `${count} CTs scheduled on ${date}. Consider spreading.`,
      });
    }
  });

  // Check for last-week CTs
  if (termInfo?.termEndDate) {
    const termEnd = new Date(termInfo.termEndDate);
    const lastWeekStart = new Date(termEnd);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekCTs = courses.filter(c =>
      (c.ctDates || []).some(d => new Date(d) >= lastWeekStart)
    ).length;

    if (lastWeekCTs > 0) {
      issues.push({
        severity: 'warning',
        message: `${lastWeekCTs} course(s) have CTs in last week. Avoid if possible.`,
      });
    }
  }

  return issues;
}
