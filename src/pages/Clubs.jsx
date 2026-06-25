import { useState } from 'react';
import { Plus, Trash2, X, Check } from 'lucide-react';
import { store, uid } from '../store/store';
import Modal from '../components/Modal';

const ld = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const CLUB_COLORS = [
  { bg: '#dcfce7', accent: '#16a34a', text: '#14532d' },
  { bg: '#dbeafe', accent: '#2563eb', text: '#1e3a8a' },
  { bg: '#fef3c7', accent: '#d97706', text: '#78350f' },
  { bg: '#fce7f3', accent: '#db2777', text: '#831843' },
  { bg: '#ede9fe', accent: '#7c3aed', text: '#4c1d95' },
  { bg: '#ffedd5', accent: '#ea580c', text: '#7c2d12' },
];

export default function Clubs() {
  const [clubs, setClubs] = useState(() => store.get('clubs') || []);
  const [activities, setActivities] = useState(() => store.get('clubActivities') || []);
  const [modal, setModal] = useState(null); // 'club' | 'activity'
  const [clubForm, setClubForm] = useState({ name: '', role: '', since: '' });
  const [actForm, setActForm] = useState({ clubId: '', title: '', date: ld(), hours: '', desc: '' });

  const setCF = (k, v) => setClubForm(f => ({ ...f, [k]: v }));
  const setAF = (k, v) => setActForm(f => ({ ...f, [k]: v }));

  const saveClub = () => {
    if (!clubForm.name.trim()) return;
    const u = [...clubs, { ...clubForm, id: uid() }];
    setClubs(u); store.set('clubs', u); setModal(null);
    setClubForm({ name: '', role: '', since: '' });
  };

  const saveAct = () => {
    if (!actForm.title || !actForm.clubId) return;
    const u = [{ ...actForm, id: uid() }, ...activities];
    setActivities(u); store.set('clubActivities', u); setModal(null);
    setActForm({ clubId: '', title: '', date: ld(), hours: '', desc: '' });
  };

  const delClub = (id) => {
    const u = clubs.filter(c => c.id !== id); setClubs(u); store.set('clubs', u);
    const ua = activities.filter(a => a.clubId !== id); setActivities(ua); store.set('clubActivities', ua);
  };

  const getClub = (id) => clubs.find(c => c.id === id);
  const getColor = (id) => CLUB_COLORS[clubs.findIndex(c => c.id === id) % CLUB_COLORS.length] || CLUB_COLORS[0];

  const clubStats = clubs.map(c => {
    const acts = activities.filter(a => a.clubId === c.id);
    const totalHours = acts.reduce((s, a) => s + (+a.hours || 0), 0);
    return { ...c, actCount: acts.length, totalHours };
  }).sort((a, b) => b.totalHours - a.totalHours);

  const totalHoursAll = activities.reduce((s, a) => s + (+a.hours || 0), 0);

  const openActivity = () => {
    setActForm({ clubId: clubs[0]?.id || '', title: '', date: ld(), hours: '', desc: '' });
    setModal('activity');
  };

  return (
    <div className="page-enter page-container">

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 70%, #2563eb 100%)',
        borderRadius: 16, padding: '18px 20px 16px', marginBottom: 16, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -24, right: -24, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(147,197,253,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Extracurricular
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Clubs & Activities</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{clubs.length}</div>
            <div style={{ fontSize: 10, color: 'rgba(147,197,253,0.8)' }}>clubs joined</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
          <div style={{ fontSize: 12, color: 'rgba(147,197,253,0.85)' }}>
            🎯 <span style={{ color: '#fff', fontWeight: 700 }}>{activities.length}</span> activities logged
          </div>
          <div style={{ fontSize: 12, color: 'rgba(147,197,253,0.85)' }}>
            ⏱️ <span style={{ color: '#fff', fontWeight: 700 }}>{totalHoursAll.toFixed(1)}h</span> total
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={openActivity} disabled={clubs.length === 0}>
          <Plus size={13} /> Log Activity
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setModal('club')}>
          <Plus size={13} /> Add Club
        </button>
      </div>

      {/* Club cards */}
      {clubStats.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎓</div>
          <p style={{ fontSize: 13 }}>Add your first club to start tracking activities.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 20 }}>
          {clubStats.map((c, i) => {
            const col = CLUB_COLORS[i % CLUB_COLORS.length];
            return (
              <div key={c.id} style={{
                background: col.bg, borderRadius: 14,
                padding: '14px 16px',
                border: `1.5px solid ${col.accent}22`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: -16, right: -16, width: 72, height: 72, borderRadius: '50%', background: `${col.accent}14` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: col.text }}>{c.name}</div>
                    {c.role && (
                      <div style={{
                        display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700,
                        background: col.accent, color: '#fff', borderRadius: 99, padding: '2px 8px',
                      }}>{c.role}</div>
                    )}
                    {i === 0 && c.totalHours > 0 && (
                      <div style={{
                        display: 'inline-block', marginTop: 4, marginLeft: 4, fontSize: 10, fontWeight: 700,
                        background: '#fff', color: col.accent, borderRadius: 99, padding: '2px 8px',
                        border: `1px solid ${col.accent}44`,
                      }}>⭐ Most Active</div>
                    )}
                  </div>
                  <button
                    style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8, padding: '5px 7px', cursor: 'pointer', color: col.text, opacity: 0.6 }}
                    onClick={() => delClub(c.id)}
                  ><Trash2 size={12} /></button>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: col.text, lineHeight: 1 }}>{c.actCount}</div>
                    <div style={{ fontSize: 11, color: col.accent, fontWeight: 600 }}>Activities</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: col.text, lineHeight: 1 }}>{c.totalHours}</div>
                    <div style={{ fontSize: 11, color: col.accent, fontWeight: 600 }}>Hours</div>
                  </div>
                  {c.since && (
                    <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: 10, color: col.accent, fontWeight: 600 }}>
                      Since {c.since}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent activities */}
      {activities.length > 0 && (
        <>
          <div className="section-title">Recent Activities</div>
          {activities.slice(0, 10).map(a => {
            const c = getClub(a.clubId);
            const col = c ? getColor(a.clubId) : CLUB_COLORS[0];
            return (
              <div key={a.id} style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '10px 14px', marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 6, height: 36, borderRadius: 99, background: col.accent, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c?.name} · {a.date}</div>
                </div>
                {a.hours && (
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: col.accent,
                    background: col.bg, borderRadius: 8, padding: '3px 8px',
                  }}>{a.hours}h</div>
                )}
                <button
                  style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', color: 'var(--danger)', opacity: 0.7 }}
                  onClick={() => { const u = activities.filter(x => x.id !== a.id); setActivities(u); store.set('clubActivities', u); }}
                ><Trash2 size={11} /></button>
              </div>
            );
          })}
        </>
      )}

      {/* Add Club Modal */}
      {modal === 'club' && (
        <Modal
          onClose={() => setModal(null)}
          overlayStyle={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.45)', padding: 0 }}
          contentStyle={{
            background: 'var(--card)', borderRadius: '16px 16px 0 0',
            padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0))',
            width: '100%', maxWidth: 500, boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Add Club</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>নতুন club যোগ করুন</div>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'var(--inputBg)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div className="form-field"><label>Club Name *</label><input value={clubForm.name} onChange={e => setCF('name', e.target.value)} placeholder="KUET Robotics Club" autoFocus /></div>
              <div className="form-field"><label>Your Role</label><input value={clubForm.role} onChange={e => setCF('role', e.target.value)} placeholder="Member / General Secretary" /></div>
              <div className="form-field"><label>Member Since</label><input type="date" value={clubForm.since} onChange={e => setCF('since', e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--inputBg)', color: 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>Cancel</button>
              <button onClick={saveClub} style={{ flex: 2, padding: 11, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>✓ Save Club</button>
            </div>
        </Modal>
      )}

      {/* Log Activity Modal */}
      {modal === 'activity' && (
        <Modal
          onClose={() => setModal(null)}
          overlayStyle={{ alignItems: 'flex-end', background: 'rgba(0,0,0,0.45)', padding: 0 }}
          contentStyle={{
            background: 'var(--card)', borderRadius: '16px 16px 0 0',
            padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0))',
            width: '100%', maxWidth: 500, boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Log Activity</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Club activity track করুন</div>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'var(--inputBg)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div className="form-field">
                <label>Club *</label>
                <select value={actForm.clubId} onChange={e => setAF('clubId', e.target.value)}>
                  <option value="">Select club</option>
                  {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-field"><label>Activity / Task *</label><input value={actForm.title} onChange={e => setAF('title', e.target.value)} placeholder="Robotics workshop preparation" autoFocus /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-field"><label>Date</label><input type="date" value={actForm.date} onChange={e => setAF('date', e.target.value)} /></div>
                <div className="form-field"><label>Hours Spent</label><input type="number" value={actForm.hours} onChange={e => setAF('hours', e.target.value)} placeholder="2" min={0} step={0.5} /></div>
              </div>
              <div className="form-field"><label>Details</label><textarea value={actForm.desc} onChange={e => setAF('desc', e.target.value)} rows={2} placeholder="What was done..." /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--inputBg)', color: 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>Cancel</button>
              <button onClick={saveAct} style={{ flex: 2, padding: 11, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>✓ Save Activity</button>
            </div>
        </Modal>
      )}
    </div>
  );
}