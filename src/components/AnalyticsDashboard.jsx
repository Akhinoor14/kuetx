// AnalyticsDashboard.jsx
//
// Usage analytics for Founder (dept=null, sees everyone) and Senior
// Campus Lead (dept='CSE' etc, sees only their own dept — enforced by
// Firestore rules, not just this prop). Same component, same data shapes,
// just a different `dept` prop and a couple of Founder-only sections
// (dept breakdown makes no sense on an already-single-dept SCL view).
//
// Layout, top to bottom: headline DAU/WAU/MAU + stickiness -> 30-day
// trend line -> retention cohorts -> role split (+ dept split, Founder
// only) -> feature adoption (lazy-loaded on tab open, since it's the one
// N-reads-per-active-user query — see analyticsEngine.js's
// computeModuleAdoption comment).

import { useState, useEffect, useMemo } from 'react';
import {
  fetchActivityDocs,
  computeActiveCounts,
  computeDailyTrend,
  computeRetention,
  computeRoleBreakdown,
  computeDeptBreakdown,
  computeModuleAdoption,
} from '../lib/analyticsEngine';

function StatCard({ label, value, sublabel }) {
  return (
    <div className="card" style={{ padding: 14, flex: '1 1 120px', minWidth: 120 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sublabel}</div>}
    </div>
  );
}

function RetentionCard({ label, data }) {
  return (
    <div className="card" style={{ padding: 12, flex: '1 1 100px', minWidth: 100, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
        {data ? `${data.pct}%` : '—'}
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
        {data ? `${data.cohortSize} in cohort` : 'not enough history yet'}
      </div>
    </div>
  );
}

/** Minimal inline SVG bar/line chart — no chart library needed for one sparkline. */
function TrendChart({ points }) {
  if (!points || points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.count));
  const w = 100 / (points.length - 1 || 1);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * w).toFixed(2)} ${(100 - (p.count / max) * 90).toFixed(2)}`)
    .join(' ');

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Daily active users — last 30 days</div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 90 }}>
        <path d={path} fill="none" stroke="var(--accent, #4f8ef7)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function BarRow({ label, count, max }) {
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: 'var(--muted)' }}>{count}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2, rgba(127,127,127,0.15))', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent, #4f8ef7)', borderRadius: 3 }} />
      </div>
    </div>
  );
}

export default function AnalyticsDashboard({ dept = null }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState('');
  const [adoption, setAdoption] = useState(null);
  const [adoptionLoading, setAdoptionLoading] = useState(false);

  useEffect(() => {
    setDocs(null);
    setError('');
    setAdoption(null);
    fetchActivityDocs({ dept })
      .then(setDocs)
      .catch((e) => {
        console.error('[AnalyticsDashboard] fetch failed:', e);
        setError(
          e?.code === 'failed-precondition'
            ? 'Analytics index is still building — try again in a minute.'
            : e?.message || 'Could not load analytics.'
        );
      });
  }, [dept]);

  const activeCounts = useMemo(() => (docs ? computeActiveCounts(docs) : null), [docs]);
  const trend = useMemo(() => (docs ? computeDailyTrend(docs) : null), [docs]);
  const retention = useMemo(() => (docs ? computeRetention(docs) : null), [docs]);
  const roleBreakdown = useMemo(() => (docs ? computeRoleBreakdown(docs) : null), [docs]);
  const deptBreakdown = useMemo(() => (docs && !dept ? computeDeptBreakdown(docs) : null), [docs, dept]);

  const loadAdoption = () => {
    if (!docs || adoption || adoptionLoading) return;
    setAdoptionLoading(true);
    computeModuleAdoption(docs)
      .then(setAdoption)
      .finally(() => setAdoptionLoading(false));
  };

  if (error) return <div style={{ fontSize: 12, color: 'var(--danger, #dc2626)', padding: 12 }}>{error}</div>;
  if (!docs) return <div style={{ fontSize: 12, color: 'var(--muted)', padding: 12 }}>Loading analytics…</div>;

  const maxDeptCount = deptBreakdown ? Math.max(1, ...deptBreakdown.map((d) => d.count)) : 1;
  const maxRoleCount = roleBreakdown ? Math.max(1, ...Object.values(roleBreakdown)) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label="Daily active" value={activeCounts.dau} sublabel="last 24h" />
        <StatCard label="Weekly active" value={activeCounts.wau} sublabel="last 7 days" />
        <StatCard label="Monthly active" value={activeCounts.mau} sublabel="last 30 days" />
        <StatCard label="Stickiness" value={`${activeCounts.stickiness}%`} sublabel="DAU / MAU" />
      </div>

      {trend && <TrendChart points={trend} />}

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Retention (returned after first visit)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <RetentionCard label="Day 1" data={retention.d1} />
          <RetentionCard label="Day 7" data={retention.d7} />
          <RetentionCard label="Day 30" data={retention.d30} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {roleBreakdown && (
          <div className="card" style={{ padding: 14, flex: '1 1 220px', minWidth: 220 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Active by role (30d)</div>
            {Object.entries(roleBreakdown).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>No active users yet.</div>
            ) : (
              Object.entries(roleBreakdown).map(([role, count]) => (
                <BarRow key={role} label={role.charAt(0).toUpperCase() + role.slice(1)} count={count} max={maxRoleCount} />
              ))
            )}
          </div>
        )}

        {deptBreakdown && (
          <div className="card" style={{ padding: 14, flex: '1 1 220px', minWidth: 220 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Active by department (30d)</div>
            {deptBreakdown.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>No active users yet.</div>
            ) : (
              deptBreakdown.map((d) => <BarRow key={d.dept} label={d.dept} count={d.count} max={maxDeptCount} />)
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Feature adoption (% of 30d active users)</div>
          {!adoption && (
            <button className="btn btn-sm btn-secondary" onClick={loadAdoption} disabled={adoptionLoading}>
              {adoptionLoading ? 'Loading…' : 'Load'}
            </button>
          )}
        </div>
        {adoption ? (
          adoption.map((m) => (
            <BarRow key={m.key} label={`${m.label} (${m.pct}%)`} count={m.users} max={Math.max(1, ...adoption.map((x) => x.users))} />
          ))
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Reads each active user's feature usage — click Load to fetch (not preloaded to save reads).
          </div>
        )}
      </div>
    </div>
  );
}
