import { useState } from 'react';
import { Moon, Clock, Pencil, Check, Flame } from 'lucide-react';
import { store } from '../store/store';

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const DEFAULT_TIMES = {
  Fajr: '05:10', Dhuhr: '12:30', Asr: '16:00', Maghrib: '18:20', Isha: '19:45'
};

export default function Namaz() {
  const _td = new Date(); const today = `${_td.getFullYear()}-${String(_td.getMonth()+1).padStart(2,'0')}-${String(_td.getDate()).padStart(2,'0')}`;
  const [records, setRecords] = useState(() => store.get('namaz') || {});
  const [times, setTimes] = useState(() => store.get('namazTimes') || DEFAULT_TIMES);
  const [selectedDate, setSelectedDate] = useState(today);
  const [editTimes, setEditTimes] = useState(false);
  const [draftTimes, setDraftTimes] = useState({ ...DEFAULT_TIMES });

  const getRec = (date) => records[date] || {};

  const toggle = (date, prayer) => {
    const rec = getRec(date);
    const prev = rec[prayer] || {};
    const updated = { ...records, [date]: { ...rec, [prayer]: { ...prev, done: !prev.done } } };
    setRecords(updated); store.set('namaz', updated);
  };

  const openEdit = () => { setDraftTimes({ ...times }); setEditTimes(true); };
  const saveEdit = () => {
    setTimes(draftTimes); store.set('namazTimes', draftTimes); setEditTimes(false);
  };

  const rec = getRec(selectedDate);
  const totalToday = PRAYERS.filter(p => rec[p]?.done).length;
  const isToday = selectedDate === today;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const r = getRec(dateStr);
    return { date: dateStr, label: d.toLocaleDateString('en', { weekday: 'short' }), done: PRAYERS.filter(p => r[p]?.done).length };
  }).reverse();

  const totalStreak = last7.filter(d => d.done === 5).length;

  return (
    <div className="page-enter page-container content-page-bg">

      {/* Hero — reuses the same shared hero classes every other content
          page uses (content-page-hero / hero-icon / hero-title /
          hero-subtitle), instead of a hand-rolled gradient card, so the
          accent wash reads consistently across pages instead of jumping
          in hue/intensity page to page. */}
      <div className="content-page-hero" style={{ marginBottom: 16 }}>
        <div className="content-page-hero-icon">
          <Moon size={18} color="var(--accent)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="content-page-hero-title">Namaz Tracker</h1>
          <p className="content-page-hero-subtitle">
            {isToday ? "Today's prayers" : selectedDate}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 26, fontWeight: 900, color: totalToday === 5 ? 'var(--accent)' : 'var(--text)',
            lineHeight: 1,
          }}>{totalToday}<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>/5</span></div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
            {totalToday === 5 ? 'Alhamdulillah' : `${5 - totalToday} left`}
          </div>
        </div>
      </div>

      {/* Date selector */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ flex: 1, fontSize: 13 }}
        />
        {!isToday && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(today)}>
            Today
          </button>
        )}
      </div>

      {/* Prayer checklist — one clear action per row (tap the row/checkbox
          to mark done), no separate "Jamaat" tracking and no second
          button whose purpose wasn't obvious next to "Mark Done". */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {PRAYERS.map(prayer => {
          const done = !!rec[prayer]?.done;
          return (
            <button
              key={prayer}
              onClick={() => toggle(selectedDate, prayer)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: done ? 'var(--successBg)' : 'var(--card)',
                border: `1px solid ${done ? 'rgba(22,163,74,0.18)' : 'var(--border)'}`,
                borderRadius: 12,
                padding: '12px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'Sora, sans-serif',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--success)' : 'var(--inputBg)',
                border: `1.5px solid ${done ? 'var(--success)' : 'var(--border)'}`,
              }}>
                {done && <Check size={14} color="#fff" strokeWidth={3} />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.1 }}>
                  {prayer}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  <Clock size={11} />
                  {times[prayer]}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 7-day streak */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
          <Flame size={14} color="var(--muted)" />
          Last 7 Days · {totalStreak}/7 full days
        </div>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
          {last7.map(d => (
            <div key={d.date} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 5, fontWeight: 500 }}>{d.label}</div>
              <div style={{
                width: 34, height: 34, borderRadius: 8, margin: '0 auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: d.done === 5 ? 'var(--accent)' : d.done > 0 ? '#fef3c7' : 'var(--inputBg)',
                color: d.done === 5 ? '#fff' : d.done > 0 ? '#92400e' : 'var(--muted)',
                border: d.date === selectedDate ? '2px solid var(--accent)' : '1px solid transparent',
              }}>{d.done}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Prayer Times — view */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Prayer Times</div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px' }}
            onClick={openEdit}
          ><Pencil size={11} /> Edit</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PRAYERS.map(p => (
            <div key={p} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 8, background: 'var(--inputBg)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                {times[p]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Times Modal */}
      {editTimes && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)', display: 'flex',
          alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 0 env(safe-area-inset-bottom, 0)',
        }} onClick={() => setEditTimes(false)}>
          <div
            style={{
              background: 'var(--card)', borderRadius: '16px 16px 0 0',
              padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0))',
              width: '100%', maxWidth: 500,
              boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Prayer Times</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Update prayer times</div>
              </div>
              <button
                onClick={() => setEditTimes(false)}
                style={{ background: 'var(--inputBg)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}
              >×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {PRAYERS.map(p => (
                <div key={p} style={{
                  display: 'flex', alignItems: 'center',
                  background: 'var(--inputBg)', borderRadius: 10, padding: '10px 14px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p}</div>
                  </div>
                  <input
                    type="time"
                    value={draftTimes[p]}
                    onChange={e => setDraftTimes(prev => ({ ...prev, [p]: e.target.value }))}
                    style={{ fontSize: 14, fontWeight: 700, padding: '4px 8px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontFamily: 'Sora, sans-serif' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setEditTimes(false)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--inputBg)', color: 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}
              >Cancel</button>
              <button
                onClick={saveEdit}
                style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}
              >Save Times</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
