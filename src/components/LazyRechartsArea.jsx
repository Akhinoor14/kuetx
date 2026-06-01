import React, { useEffect, useState } from 'react';

export default function LazyRechartsArea({ data = [], height = 180 }) {
  const [libs, setLibs] = useState(null);

  useEffect(() => {
    let cancelled = false;
    import('recharts').then(mod => {
      if (!cancelled) setLibs(mod);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!libs) return <div style={{ width: '100%', height }} />;

  const { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } = libs;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 40, right: 10, left: 30, bottom: 10 }}>
        <defs>
          <linearGradient id="dashGpaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.9} />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0.18} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--accentRGB), 0.08)" />
        <XAxis dataKey="term" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
        <YAxis domain={[0, 4]} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
        <ReferenceLine y={3.75} stroke="#10b981" strokeDasharray="4 2" opacity={0.5} />
        <ReferenceLine y={2.20} stroke="#f59e0b" strokeDasharray="4 2" opacity={0.5} />
        <Tooltip />
        <Area type="monotone" dataKey="gpa" stroke="#7C3AED" fill="url(#dashGpaGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
