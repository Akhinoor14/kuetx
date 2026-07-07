import { useState } from 'react';
import { store } from '../store/store';

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const PRAYER_ICONS = { Fajr: '🌙', Dhuhr: '☀️', Asr: '🌤️', Maghrib: '🌇', Isha: '🌙' };
const PRAYER_ARABIC = { Fajr: 'ফজর', Dhuhr: 'যোহর', Asr: 'আসর', Maghrib: 'মাগরিব', Isha: 'ইশা' };

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

  const toggle = (date, prayer, field) => {
    const rec = getRec(date);
    const prev = rec[prayer] || {};
    const updated = { ...records, [date]: { ...rec, [prayer]: { ...prev, [field]: !prev[field] } } };
    setRecords(updated); store.set('namaz', updated);
  };

  const openEdit = () => { setDraftTimes({ ...times }); setEditTimes(true); };
  const saveEdit = () => {
    setTimes(draftTimes); store.set('namazTimes', draftTimes); setEditTimes(false);
  };

  const rec = getRec(selectedDate);
  const totalToday = PRAYERS.filter(p => rec[p]?.done).length;
  const totalMasjid = PRAYERS.filter(p => rec[p]?.masjid).length;
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

      {/* Hero Header — theme-tinted, matches every other content page */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(var(--accentRGB), 0.16) 0%, rgba(var(--accentRGB), 0.06) 60%, var(--surface) 100%)',
        border: '1px solid rgba(var(--accentRGB), 0.16)',
        borderRadius: 16,
        padding: '20px 20px 16px',
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(var(--accentRGB), 0.08)',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: '40%',
          width: 100, height: 100, borderRadius: '50%',
          background: 'rgba(var(--accentRGB), 0.06)',
        }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div className="content-page-hero-icon" style={{ marginTop: 2 }}>
              <span style={{ fontSize: 18 }}>🌙</span>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                Daily Salah
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.1 }}>
                Namaz Tracker
              </h1>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                {isToday ? "আজকের নামাজ" : selectedDate}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 30, fontWeight: 900, color: totalToday === 5 ? 'var(--accent)' : 'var(--text)',
              lineHeight: 1,
            }}>{totalToday}<span style={{ fontSize: 16, fontWeight: 600, color: 'var(--muted)' }}>/5</span></div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              {totalToday === 5 ? '✓ আলহামদুলিল্লাহ' : `${5 - totalToday} remaining`}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 14, height: 4, background: 'rgba(var(--accentRGB), 0.14)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${(totalToday / 5) * 100}%`,
            background: 'var(--accent)',
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            🕌 <span style={{ color: 'var(--text)', fontWeight: 700 }}>{totalMasjid}</span> in Masjid
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            🔥 <span style={{ color: 'var(--text)', fontWeight: 700 }}>{totalStreak}</span>/7 full days
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

      {/* Prayer cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {PRAYERS.map(prayer => {
          const r = rec[prayer] || {};
          const bothDone = r.done && r.masjid;
          const anyDone = r.done || r.masjid;
          return (
            <div key={prayer} style={{
              background: anyDone ? 'var(--successBg)' : 'var(--card)',
              border: `1px solid ${anyDone ? 'rgba(22,163,74,0.18)' : 'var(--border)'}`,
              borderRadius: 12,
              padding: '12px 14px',
              transition: 'all 0.2s ease',
            }}>
              {/* Top row: icon + name + time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{PRAYER_ICONS[prayer]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', lineHeight: 1.1 }}>
                    {prayer}
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>
                      {PRAYER_ARABIC[prayer]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 1 }}>
                    🕐 {times[prayer]}
                  </div>
                </div>
                {bothDone && <span style={{ fontSize: 16 }}>✅</span>}
              </div>

              {/* Bottom row: buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggle(selectedDate, prayer, 'masjid')}
                  style={{
                    flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif',
                    background: r.masjid ? 'var(--accent)' : 'var(--inputBg)',
                    color: r.masjid ? '#fff' : 'var(--muted)',
                    border: `1.5px solid ${r.masjid ? 'var(--accent)' : 'var(--border)'}`,
                    transition: 'all 0.15s ease',
                  }}
                >🕌 Masjid</button>
                <button
                  onClick={() => toggle(selectedDate, prayer, 'done')}
                  style={{
                    flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12,
                    fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif',
                    background: r.done ? 'var(--success)' : 'var(--inputBg)',
                    color: r.done ? '#fff' : 'var(--muted)',
                    border: `1.5px solid ${r.done ? 'var(--success)' : 'var(--border)'}`,
                    transition: 'all 0.15s ease',
                  }}
                >{r.done ? '✓ Done' : 'Mark Done'}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 7-day streak */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
          Last 7 Days
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

      {/* Jamat Times — view */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Jamat Times</div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={openEdit}
          >✏️ Edit</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PRAYERS.map(p => (
            <div key={p} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 8, background: 'var(--inputBg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>{PRAYER_ICONS[p]}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{PRAYER_ARABIC[p]}</span>
              </div>
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
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Jamat Times</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>নামাজের সময় আপডেট করুন</div>
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
                  <span style={{ fontSize: 18, marginRight: 10 }}>{PRAYER_ICONS[p]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{PRAYER_ARABIC[p]}</div>
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
              >✓ Save Times</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}