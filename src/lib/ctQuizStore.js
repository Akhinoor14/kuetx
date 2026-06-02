/**
 * CT Quiz & Holidays Store
 * Year-based holiday system - single source of truth
 * 
 * All holidays are stored by calendar year in holidays.json
 * Any term in that year automatically gets those holidays
 */

import holidaysData from '../data/holidays.json';
import { store } from '../store/store';

/**
 * Get holidays for a given year
 * @param {number|string} year - Calendar year (e.g., 2025, 2026, 2027)
 * @returns {Array} Array of holiday objects {date, name, end?}
 */
export function getYearHolidays(year) {
  const yearKey = String(year);
  const yearData = holidaysData[yearKey];
  
  if (!yearData) {
    console.warn(`[ctQuizStore] No holidays found for year: ${year}`);
    return [];
  }
  
  const allHolidays = [];
  
  // Collect from all holiday lists
  if (yearData.holidays?.length) {
    allHolidays.push(...yearData.holidays);
  }
  if (yearData.nonInstructionWeeks?.length) {
    allHolidays.push(...yearData.nonInstructionWeeks);
  }
  if (yearData.singleHolidayDates?.length) {
    allHolidays.push(...yearData.singleHolidayDates);
  }
  
  return allHolidays;
}

/**
 * Extract calendar year from a profile with termStartDate
 * @param {Object} profile - User profile {termStartDate, dept, ...}
 * @returns {number} Calendar year
 */
export function getCalendarYearFromProfile(profile) {
  if (!profile?.termStartDate) return new Date().getFullYear();
  const year = new Date(profile.termStartDate).getFullYear();
  return year;
}

/**
 * Sync holidays from holidays.json to scheduleSettings
 * Merges with existing user-added holidays
 * @param {Object} profile - User profile {termStartDate, ...}
 */
export function syncTermHolidaysToSettings(profile) {
  const year = getCalendarYearFromProfile(profile);
  const defaultHolidays = getYearHolidays(year);
  
  // Get current schedule settings
  const scheduleSettings = store.get('scheduleSettings') || {};
  const existingHolidayDates = scheduleSettings.holidayDates || [];
  
  // Merge: default holidays + user additions (no duplicates)
  const merged = [...defaultHolidays];
  
  // Add user-added holidays that aren't already there
  existingHolidayDates.forEach(userHol => {
    const exists = merged.some(dHol => 
      (dHol.date === userHol.date && dHol.name === userHol.name) ||
      (dHol.start === userHol.start && dHol.end === userHol.end)
    );
    if (!exists) {
      merged.push(userHol);
    }
  });
  
  // Sort by date
  merged.sort((a, b) => {
    const dateA = new Date(a.date || a.start);
    const dateB = new Date(b.date || b.start);
    return dateA - dateB;
  });
  
  // Update store
  scheduleSettings.holidayDates = merged;
  scheduleSettings.holidayYear = year;
  store.set('scheduleSettings', scheduleSettings);
  
  console.log(`[ctQuizStore] Synced ${merged.length} holidays for year ${year}`);
}

/**
 * Dummy exports for compatibility with existing imports
 * These can be removed once all imports are cleaned up
 */

export function getTermHolidays(termCode) {
  // If no termCode, fallback to current year
  if (!termCode) return getYearHolidays(new Date().getFullYear());
  return getYearHolidays(new Date().getFullYear());
}

export function getTermTimelineInfo(profile) {
  if (!profile?.termStartDate) {
    return { termStartDate: null, termCode: null };
  }
  const year = getCalendarYearFromProfile(profile);
  return {
    termStartDate: profile.termStartDate,
    year,
    termCode: `Y${year}T1`, // Dummy - not used in year-based system
  };
}

export function getDepartmentInfo(dept) {
  return { dept, name: dept || 'Unknown' };
}

export function getCTQuizPlans() {
  return store.get('ctQuizPlans') || {};
}

export function saveCTQuizPlans(plans) {
  store.set('ctQuizPlans', plans);
}

export function getCurrentTermCourses(profile) {
  return [];
}

export function exportPlansAsJSON(plans) {
  return JSON.stringify(plans, null, 2);
}

export function importPlansFromJSON(json) {
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error('Invalid JSON:', e);
    return {};
  }
}
