import { useSearchParams } from 'react-router-dom';

/**
 * Drop-in replacement for `useState` for tab/sub-view selection, backed by
 * a URL search param instead of component state.
 *
 * BUGFIX (back-button skips whole page): several nested dashboards
 * (AdminDashboard's category grid, its per-category sub-tabs, TeamDashboard's
 * role tabs) used to track "which tab/section is showing" with plain
 * useState. Since that never touched browser history, pressing Back while
 * three levels deep (e.g. Founder tab -> Approvals category -> CR Requests
 * sub-tab) skipped all three levels at once and left the page entirely,
 * instead of walking back out one level at a time.
 *
 * Usage is identical to useState:
 *   const [subTab, setSubTab] = useUrlTabState('subTab', 'cl-apps');
 *
 * Multiple independent tab states can coexist on one page as long as each
 * uses a distinct `paramName` (e.g. 'tab', 'founderView', 'subTab').
 *
 * @param {string} paramName - URL search param key for this piece of state.
 * @param {string|null} defaultValue - value returned when the param is absent.
 * @returns {[string, (next: string|null) => void]}
 */
export function useUrlTabState(paramName, defaultValue = null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(paramName) ?? defaultValue;

  const setValue = (next) => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (next === null || next === undefined || next === defaultValue) {
        nextParams.delete(paramName);
      } else {
        nextParams.set(paramName, next);
      }
      return nextParams;
    });
  };

  return [value, setValue];
}
