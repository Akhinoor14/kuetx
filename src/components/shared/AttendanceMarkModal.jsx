// AttendanceMarkModal.jsx — shared presentational component.
//
// Extracted from pages/Attendance.jsx's DailyLog (the openCard modal) so
// the Dashboard's Today's Actions column can open the exact same
// Present/Absent + Switch-teacher UI, instead of re-implementing a
// separate "quick mark" flow. Same component, same behavior, two call
// sites — a mark made from the dashboard and a mark made from the
// Attendance page look and behave identically, because it's literally
// the same code.
//
// showMarkButtons controls whether Present/Absent appear INSIDE the modal
// (default true — this is the original /attendance page behavior: row
// click opens the modal, marking happens from the buttons here). Pass
// false when the caller's own row already has working Present/Absent
// buttons and only wants this modal for teacher confirm/switch (that's
// the Dashboard's Today's Actions card).
//
// Props are the already-resolved values for ONE (course, teacher) row —
// this component itself has no store access and no knowledge of
// cardData/rotation; the caller (DailyLog or the dashboard action list)
// is responsible for resolving those first (see lib/attendanceCore.js).
import { Users, RefreshCw, ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import Modal from '../Modal';
import { getDisplayCourseName } from '../../lib/attendanceCore';

export default function AttendanceMarkModal({
  course, teacher, status, dateLabel,
  switchOptions, onMark, onSwitch, onClose, dark,
  showMarkButtons = true,
}) {
  const [switching, setSwitching] = useState(false);

  return (
    <Modal onClose={onClose} contentStyle={{ width: 'min(calc(100vw - 24px), 360px)', maxWidth: '100%', padding: 16, background: 'var(--bg)' }}>
      <div className="card" style={{ background: 'transparent', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.3 }}>{getDisplayCourseName(course)}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>{dateLabel}</div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: showMarkButtons ? 12 : 4, padding: '10px 12px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <Users size={10} /> Teacher
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.25, color: 'var(--text)', overflowWrap: 'break-word' }}>
              {teacher || 'Unknown teacher'}
            </div>
          </div>
          {switchOptions.length === 1 && (
            <button
              onClick={() => onSwitch(switchOptions[0])}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '7px 10px', borderRadius: 8,
                border: '1.5px solid var(--accent)', background: 'transparent', color: 'var(--accent)',
                cursor: 'pointer', fontSize: 10.5, fontWeight: 800, flexShrink: 0, WebkitTapHighlightColor: 'transparent',
                maxWidth: 110,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><RefreshCw size={11} /> Switch to</span>
              <span style={{ fontWeight: 900, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{switchOptions[0]}</span>
            </button>
          )}
          {switchOptions.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSwitching(s => !s); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderRadius: 8,
                border: '1.5px solid var(--accent)',
                background: switching ? 'var(--accent)' : 'transparent',
                color: switching ? 'white' : 'var(--accent)',
                cursor: 'pointer', fontSize: 11, fontWeight: 800, flexShrink: 0, WebkitTapHighlightColor: 'transparent',
              }}
            >
              <RefreshCw size={11} />
              Switch
              {switching ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {switching && switchOptions.length > 1 && (
          <div style={{ marginBottom: showMarkButtons ? 12 : 4, padding: '9px 10px', background: dark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.20)', borderRadius: 9 }}>
            <div style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 700, marginBottom: 7 }}>
              Only for {dateLabel} — pick who actually taught:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {switchOptions.map(name => (
                <button
                  key={name}
                  onClick={() => { onSwitch(name); setSwitching(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: '1.5px solid var(--accent)', background: dark ? 'rgba(255,255,255,0.04)' : 'white',
                    color: 'var(--text)', cursor: 'pointer', width: '100%', textAlign: 'left', WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {name}
                  <RefreshCw size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {showMarkButtons ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Mark attendance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { val: 'present', label: 'Present', icon: '✓', col: '#10b981' },
                { val: 'absent', label: 'Absent', icon: '✗', col: '#ef4444' },
              ].map(opt => {
                const active = status === opt.val;
                return (
                  <button
                    key={opt.val}
                    onClick={() => onMark(opt.val)}
                    style={{
                      padding: '12px 6px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                      background: active ? opt.col : dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.80)',
                      color: active ? 'white' : 'var(--muted)',
                      border: `2px solid ${active ? opt.col : dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'}`,
                      transition: 'all 0.14s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{opt.icon} {opt.label}</span>
                    {active && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, opacity: 0.9 }}>
                        <RotateCcw size={9} /> tap to undo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>
            Close this and tap Present or Absent on the card.
          </div>
        )}
      </div>
    </Modal>
  );
}
