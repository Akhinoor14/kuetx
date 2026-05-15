import { useState } from 'react';
import { store } from '../store/store';

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const DEFAULT_TIMES = {
  Fajr: '05:10', Dhuhr: '12:30', Asr: '16:00', Maghrib: '18:20', Isha: '19:45'
};

export default function Namaz() {
  const today = new Date().toISOString().split('T')[0];
  const [records, setRecords] = useState(() => store.get('namaz') || {});
  const [times, setTimes] = useState(() => store.get('namazTimes') || DEFAULT_TIMES);
  const [selectedDate, setSelectedDate] = useState(today);
  const [editTimes, setEditTimes] = useState(false);

  const getRec = (date) => records[date] || {};

  const toggle = (date, prayer, field) => {
    const rec = getRec(date);
    const prev = rec[prayer] || {};
    const updated = { ...records, [date]: { ...rec, [prayer]: { ...prev, [field]: !prev[field] } } };
    setRecords(updated); store.set('namaz', updated);
  };

  const saveTime = (prayer, val) => {
    const updated = { ...times, [prayer]: val };
    setTimes(updated); store.set('namazTimes', updated);
  };

  const rec = getRec(selectedDate);
  const totalToday = PRAYERS.filter(p => rec[p]?.done).length;

  // Last 7 days stats
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const r = getRec(dateStr);
    return { date: dateStr, label: d.toLocaleDateString('en', { weekday: 'short' }), done: PRAYERS.filter(p => r[p]?.done).length };
  }).reverse();

  return (
    <div className="page-enter page-container">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Namaz Tracker</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Daily salah with masjid/home tracking</p>
      </div>

      {/* Date selector */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: 'auto' }} />
        <button className="btn btn-ghost" onClick={() => setSelectedDate(today)}>Today</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: totalToday === 5 ? 'var(--success)' : 'var(--muted)' }}>
          {totalToday}/5 {totalToday === 5 ? '✓ Complete' : ''}
        </span>
      </div>

      {/* Prayer cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {PRAYERS.map(prayer => {
          const r = rec[prayer] || {};
          return (
            <div key={prayer} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{prayer}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{times[prayer]}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggle(selectedDate, prayer, 'masjid')}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: r.masjid ? 'var(--accent)' : 'var(--bg)',
                    color: r.masjid ? 'var(--accentFg)' : 'var(--muted)',
                    border: `1px solid ${r.masjid ? 'var(--accent)' : 'var(--border)'}`,
                    fontFamily: 'Sora, sans-serif',
                  }}
                >🕌 Masjid</button>
                <button
                  onClick={() => toggle(selectedDate, prayer, 'done')}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: r.done ? 'var(--success)' : 'var(--bg)',
                    color: r.done ? '#fff' : 'var(--muted)',
                    border: `1px solid ${r.done ? 'var(--success)' : 'var(--border)'}`,
                    fontFamily: 'Sora, sans-serif',
                  }}
                >{r.done ? '✓ Done' : 'Mark Done'}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 7-day streak */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Last 7 Days</div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          {last7.map(d => (
            <div key={d.date} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{d.label}</div>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', margin: '0 auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: d.done === 5 ? 'var(--accent)' : d.done > 0 ? 'var(--warning)' : 'var(--border)',
                color: d.done > 0 ? (d.done === 5 ? 'var(--accentFg)' : '#fff') : 'var(--muted)',
              }}>{d.done}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Prayer times settings */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Jamat Times</div>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setEditTimes(!editTimes)}>
            {editTimes ? 'Done' : 'Edit'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {PRAYERS.map(p => (
            <div key={p} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{p}</div>
              {editTimes
                ? <input type="time" value={times[p]} onChange={e => saveTime(p, e.target.value)} style={{ fontSize: 11, padding: '4px 6px' }} />
                : <div style={{ fontSize: 13, fontWeight: 600 }}>{times[p]}</div>
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
