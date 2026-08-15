// useCanonicalQuestions.js
//
// Data-loading hook for the new JSON-based canonical Question Bank
// (public/canonical-questions/), replacing the old PDF/R2-based
// useQuestionBankData.js as the data source for QuestionBankSolutions.jsx
// (see PROGRESS_QB_WEBSITE_INTEGRATION.md, ধাপ D).
//
// Source of truth on disk:
//   public/canonical-questions/_index.json
//     { generated_at, total_question_files,
//       departments: { [DEPT]: { label, terms: { [Y#T#]: { courses:
//         { [COURSE_CODE_underscored]: { question_count, files: [...] } } } } } } }
//   public/canonical-questions/{DEPT}/{Y#T#}/{COURSE_CODE_underscored}/{file}.json
//     -> single question, or an array of question objects (root is always
//        an array per the pipeline schema; a lone object is normalized to
//        a 1-item array here too, defensively).
//
// This hook is intentionally split into three independent pieces so a
// consumer only pays for what it actually renders:
//   - useCanonicalIndex()        -> the whole _index.json (small, ~KBs)
//   - useCanonicalCourseList(dept, term) -> just course codes + counts
//   - useCanonicalQuestions(dept, term, course) -> the actual question
//     objects for one course, fetched+merged from its file list
//
// All fetches are in-memory cached at module scope (Map) so navigating
// back and forth between courses/terms within one page session doesn't
// re-fetch. This does not persist across full reloads — that's fine,
// browser HTTP cache still applies to the underlying network requests.

import { useEffect, useState, useCallback, useRef } from 'react';

const INDEX_URL = '/canonical-questions/_index.json';

// module-scope caches -- shared across every hook instance/mount
const indexCache = { promise: null, data: null };
const questionFileCache = new Map(); // url -> parsed question array

function normalizeToArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

async function fetchIndex() {
  if (indexCache.data) return indexCache.data;
  if (!indexCache.promise) {
    indexCache.promise = fetch(INDEX_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`canonical-questions index fetch failed: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        indexCache.data = data;
        return data;
      })
      .catch((err) => {
        // reset so a later retry can re-attempt the fetch instead of
        // being stuck replaying a rejected promise forever
        indexCache.promise = null;
        throw err;
      });
  }
  return indexCache.promise;
}

async function fetchQuestionFile(url) {
  if (questionFileCache.has(url)) return questionFileCache.get(url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`question file fetch failed (${res.status}): ${url}`);
  }
  const data = await res.json();
  const arr = normalizeToArray(data);
  questionFileCache.set(url, arr);
  return arr;
}

// ─────────────────────────────────────────────────────────────────────────
// useCanonicalIndex — the raw index, for department/term/course pickers
// ─────────────────────────────────────────────────────────────────────────
export function useCanonicalIndex() {
  const [index, setIndex] = useState(indexCache.data);
  const [loading, setLoading] = useState(!indexCache.data);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (indexCache.data) {
      setIndex(indexCache.data);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchIndex()
      .then((data) => {
        if (!cancelled) {
          setIndex(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { index, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────
// useCanonicalCourseList — course codes + counts for one dept+term, without
// pulling in every department's data (index itself is small so this is
// mostly a convenience/derivation helper, not a separate fetch).
// ─────────────────────────────────────────────────────────────────────────
export function useCanonicalCourseList(dept, term) {
  const { index, loading, error } = useCanonicalIndex();

  const courses = (() => {
    if (!index || !dept || !term) return [];
    const deptEntry = index.departments?.[dept];
    const termEntry = deptEntry?.terms?.[term];
    if (!termEntry?.courses) return [];
    return Object.entries(termEntry.courses).map(([code, info]) => ({
      code,
      // course JSON on disk uses underscores ("ARCH_1131"); display code
      // conventionally has a space ("ARCH 1131") -- give both so callers
      // don't have to re-derive it.
      displayCode: code.replace('_', ' '),
      questionCount: info.question_count,
    }));
  })();

  return { courses, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────
// useCanonicalQuestions — actual question objects for one dept+term+course,
// fetched (and cached) per-file, merged into one flat array.
// ─────────────────────────────────────────────────────────────────────────
export function useCanonicalQuestions(dept, term, course) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // guards against a stale slower fetch overwriting a newer selection's
  // result if dept/term/course changes again before the first resolves
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!dept || !term || !course) {
      setQuestions([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const index = await fetchIndex();
      const courseEntry = index.departments?.[dept]?.terms?.[term]?.courses?.[course];
      const files = courseEntry?.files || [];

      const results = await Promise.all(
        files.map((filename) =>
          fetchQuestionFile(`/canonical-questions/${dept}/${term}/${course}/${filename}`)
        )
      );

      if (requestIdRef.current !== requestId) return; // superseded, drop

      setQuestions(results.flat());
      setLoading(false);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err);
      setLoading(false);
    }
  }, [dept, term, course]);

  useEffect(() => {
    load();
  }, [load]);

  return { questions, loading, error, reload: load };
}
