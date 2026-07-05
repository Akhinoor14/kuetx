import { useState, useEffect, useCallback } from 'react';

const WORKER_URL = import.meta.env.VITE_QB_WORKER_URL;

/**
 * Fetches the live R2 bucket listing from the Cloudflare Worker.
 * Returns: { tree, count, loading, error, refetch }
 * tree shape: { [DEPT]: { [TERM]: { [CourseCode]: [ {label, key, size, uploaded} ] } } }
 */
export function useQuestionBankData() {
  const [tree, setTree] = useState({});
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!WORKER_URL) {
      setError('VITE_QB_WORKER_URL is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(WORKER_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Worker responded with ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTree(data.tree || {});
      setCount(data.count || 0);
    } catch (err) {
      setError(err.message || 'Failed to load question bank data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { tree, count, loading, error, refetch: fetchData };
}

/** Builds the public R2 file URL for a given object key. */
export function getR2FileUrl(key) {
  const base = 'https://pub-cee9fbc08d344601be081906d1dcf3d3.r2.dev';
  return `${base}/${key}`;
}
