/**
 * CT & Quiz Planning Store
 * Centralized data access layer - integrates with existing ecosystem
 */

import { store, getProfile, getCurrentTermKey, getTermTimeline, DEPARTMENTS } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import holidaysData from '../data/holidays.json';

const CT_QUIZ_PLANS_KEY = 'ct_quiz_plans';

/**
 * Get all holidays for a term
 */
export function getTermHolidays(termCode) {
  try {
    // Extract year: T2026S1 -> 2026
    const yearMatch = termCode?.match(/T(\d{4})/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

    const termHols = holidaysData[year]?.[termCode];
    if (!termHols) return [];

    const dates = [];
    
    // Add individual holidays
    if (termHols.holidays && Array.isArray(termHols.holidays)) {
      dates.push(...termHols.holidays.map(h => h.date));
    }

    // Add non-instruction weeks
    if (termHols.nonInstructionWeeks && Array.isArray(termHols.nonInstructionWeeks)) {
      termHols.nonInstructionWeeks.forEach(week => {
        const start = new Date(week.start);
        const end = new Date(week.end);
        const current = new Date(start);
        while (current <= end) {
          dates.push(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
      });
    }

    return [...new Set(dates)].sort();
  } catch (e) {
    console.error('[ctQuizStore] Error loading holidays:', e);
    return [];
  }
}

/**
 * Get term timeline info (start date, end date, weeks, etc.)
 */
export function getTermTimelineInfo(profile = {}) {
  try {
    const dept = profile.dept || 'ME';
    const termKey = getCurrentTermKey(profile);
    const termStartDate = profile.termStartDate;

    if (!termStartDate) {
      console.warn('[ctQuizStore] No termStartDate in profile');
      return null;
    }

    const timeline = getTermTimeline(termStartDate, dept, termKey);
    return timeline;
  } catch (e) {
    console.error('[ctQuizStore] Error getting term timeline:', e);
    return null;
  }
}

/**
 * Get current term courses with teacher info from schedule
 */
export function getCurrentTermCourses(profile = {}) {
  try {
    const dept = profile.dept || 'ME';
    const termKey = getCurrentTermKey(profile);

    // Get curriculum courses
    const allCourses = getAllCourses(profile);
    
    // Get current term courses (filter by termKey match)
    const currentTermCourses = allCourses.filter(course => {
      const courseTermKey = course.courseId?.split(':')?.[1];
      return courseTermKey === termKey;
    });

    // Enrich with teacher info from schedule settings
    const scheduleSettings = store.get('scheduleSettings') || {};
    const courseTeacherMap = scheduleSettings.courseTeacherMap || {};

    return currentTermCourses.map(course => ({
      ...course,
      teachers: courseTeacherMap[course.courseId] || ['Teacher 1', 'Teacher 2'],
    }));
  } catch (e) {
    console.error('[ctQuizStore] Error getting current term courses:', e);
    return [];
  }
}

/**
 * Get CT/Quiz plans for current term
 */
export function getCTQuizPlans(profile = {}) {
  try {
    const termKey = getCurrentTermKey(profile);
    const allPlans = store.get(CT_QUIZ_PLANS_KEY) || {};
    return allPlans[termKey] || null;
  } catch (e) {
    console.error('[ctQuizStore] Error getting CT/Quiz plans:', e);
    return null;
  }
}

/**
 * Save CT/Quiz plans for current term
 */
export function saveCTQuizPlans(plans, profile = {}) {
  try {
    const termKey = getCurrentTermKey(profile);
    const allPlans = store.get(CT_QUIZ_PLANS_KEY) || {};
    allPlans[termKey] = {
      ...plans,
      lastModified: new Date().toISOString().split('T')[0],
    };
    store.set(CT_QUIZ_PLANS_KEY, allPlans);
    return true;
  } catch (e) {
    console.error('[ctQuizStore] Error saving CT/Quiz plans:', e);
    return false;
  }
}

/**
 * Get department info
 */
export function getDepartmentInfo(deptCode = 'ME') {
  const dept = DEPARTMENTS.find(d => d.code === deptCode);
  return dept || { code: deptCode, name: deptCode, seats: 0 };
}

/**
 * Calculate default CT count for theory course
 */
export function getDefaultCTCount(credits = 3) {
  // Default: 3 CTs minimum for most theory courses
  if (credits >= 3) return 3;
  if (credits >= 2) return 2;
  return 1;
}

/**
 * Calculate instruction days (business days excluding holidays and opening/closing weeks)
 */
export function calculateInstructionDays(termStartDate, termEndDate, holidays = [], skipFirstWeeks = 2, skipLastWeeks = 1) {
  try {
    const start = new Date(termStartDate);
    const end = new Date(termEndDate);
    
    // Calculate week boundaries
    const firstWeekEnd = new Date(start);
    firstWeekEnd.setDate(firstWeekEnd.getDate() + skipFirstWeeks * 7);
    
    const lastWeekStart = new Date(end);
    lastWeekStart.setDate(lastWeekStart.getDate() - skipLastWeeks * 7);
    
    // Get business days
    const holidaySet = new Set(holidays);
    const businessDays = [];
    
    const current = new Date(firstWeekEnd);
    while (current <= lastWeekStart) {
      const dateStr = current.toISOString().split('T')[0];
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      const isHoliday = holidaySet.has(dateStr);
      
      if (!isWeekend && !isHoliday) {
        businessDays.push(dateStr);
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return businessDays;
  } catch (e) {
    console.error('[ctQuizStore] Error calculating instruction days:', e);
    return [];
  }
}

/**
 * Generate evenly-spaced CT dates
 */
export function generateCTDates(availableDays = [], numCTs = 3, minGapDays = 12) {
  try {
    if (!availableDays.length || numCTs <= 0) return [];
    
    const dates = [];
    const step = Math.max(1, Math.floor((availableDays.length - 1) / (numCTs + 1)));
    
    for (let i = 1; i <= numCTs; i++) {
      const idx = Math.min(i * step, availableDays.length - 1);
      dates.push(availableDays[idx]);
    }
    
    // Validate gaps
    const warnings = [];
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const gapDays = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
      if (gapDays < minGapDays) {
        warnings.push(`Gap between ${dates[i - 1]} and ${dates[i]} is ${gapDays} days (min: ${minGapDays})`);
      }
    }
    
    return { dates, warnings };
  } catch (e) {
    console.error('[ctQuizStore] Error generating CT dates:', e);
    return { dates: [], warnings: ['Error generating dates'] };
  }
}

/**
 * Export plans to JSON
 */
export function exportPlansAsJSON(profile = {}) {
  try {
    const plans = getCTQuizPlans(profile);
    if (!plans) return null;
    
    return {
      exportedAt: new Date().toISOString(),
      profile: {
        dept: profile.dept,
        termKey: getCurrentTermKey(profile),
      },
      plans,
    };
  } catch (e) {
    console.error('[ctQuizStore] Error exporting plans:', e);
    return null;
  }
}

/**
 * Import plans from JSON
 */
export function importPlansFromJSON(jsonData, profile = {}) {
  try {
    if (!jsonData?.plans) throw new Error('Invalid import format');
    
    saveCTQuizPlans(jsonData.plans, profile);
    return true;
  } catch (e) {
    console.error('[ctQuizStore] Error importing plans:', e);
    return false;
  }
}
