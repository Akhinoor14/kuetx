// useQBShowcaseStats.js — landing-page-only derived view over the same
// live QB data useQuestionBankData.js already fetches from the public
// Cloudflare Worker (VITE_QB_WORKER_URL). No new backend call, no auth
// needed (the Worker's CORS is public, see cloudflare-worker/src/index.js
// `cors()` — Access-Control-Allow-Origin defaults to '*'), and no new
// Firestore read — this only reshapes `tree`/`count` that hook already
// returns into what the rotating landing card needs:
//   - total paper count (same number as useQuestionBankData's `count`)
//   - per-department totals, sorted descending, for the "top department"
//     fact
//   - department count (Object.keys(tree).length)
//
// Deliberately does NOT duplicate the fetch — takes the same hook's
// output as input, so there is exactly one network call for QB data on
// this page, not two.
export function deriveQBShowcaseStats(tree, count) {
  const deptTotals = Object.entries(tree || {}).map(([dept, terms]) => {
    let total = 0;
    Object.values(terms || {}).forEach((courses) => {
      Object.values(courses || {}).forEach((files) => {
        total += Array.isArray(files) ? files.length : 0;
      });
    });
    return { dept, total };
  }).sort((a, b) => b.total - a.total);

  return {
    totalPapers: count || 0,
    deptCount: deptTotals.length,
    topDept: deptTotals[0] || null, // { dept, total } | null
  };
}
