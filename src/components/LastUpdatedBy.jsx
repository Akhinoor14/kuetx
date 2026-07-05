// Reused under the routine grid, assignment list, and CR board so the
// "last updated by NAME · ROLL · date time" line always looks identical.

function formatWhen(ts) {
  if (!ts) return '';
  // Firestore Timestamp has .toDate(); serverTimestamp() resolves to it
  // once the write round-trips, but is null in the optimistic local write.
  const date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function LastUpdatedBy({ meta, at, compact = false }) {
  if (!meta?.name && !meta?.roll) return null;
  const when = formatWhen(at);
  return (
    <div
      style={{
        fontSize: compact ? 11 : 12,
        color: 'var(--muted)',
        marginTop: compact ? 4 : 8,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span>Last updated by <strong style={{ color: 'var(--text)' }}>{meta.name}</strong>{meta.roll ? ` (${meta.roll})` : ''}</span>
      {when && <span>· {when}</span>}
    </div>
  );
}
