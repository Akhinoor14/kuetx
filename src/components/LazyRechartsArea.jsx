import React, { useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';

export default function LazyRechartsArea({ data = [], height = 180 }) {
  const { theme, themeId } = useTheme();
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

  // Use theme colors for chart
  const isDark = themeId === 'dark';
  const accentColor = theme['--accent'] || '#16a34a';
  const textColor = theme['--text'] || '#1c1c1a';
  const mutedColor = theme['--muted'] || '#6b6860';
  const borderColor = theme['--border'] || '#e2e0db';
  
  // Create gradient stops using theme colors
  const gradientStartColor = isDark ? '#7C3AED' : '#3B82F6';
  const gradientMidColor = isDark ? '#3B82F6' : '#06B6D4';
  const gradientEndColor = isDark ? '#10B981' : accentColor;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 40, right: 10, left: 30, bottom: 10 }}>
        <defs>
          <linearGradient id="dashGpaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientStartColor} stopOpacity={0.9} />
            <stop offset="50%" stopColor={gradientMidColor} stopOpacity={0.6} />
            <stop offset="100%" stopColor={gradientEndColor} stopOpacity={0.18} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={`rgba(var(--accentRGB), 0.08)`} />
        <XAxis dataKey="term" tick={{ fontSize: 10, fill: mutedColor }} />
        <YAxis domain={[0, 4]} tick={{ fontSize: 10, fill: mutedColor }} />
        <ReferenceLine y={3.75} stroke={gradientEndColor} strokeDasharray="4 2" opacity={0.5} />
        <ReferenceLine y={2.20} stroke={isDark ? '#f59e0b' : '#d97706'} strokeDasharray="4 2" opacity={0.5} />
        <Tooltip />
        <Area type="monotone" dataKey="gpa" stroke={gradientStartColor} fill="url(#dashGpaGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
