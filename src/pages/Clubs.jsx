import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { store, uid } from '../store/store';

export default function Clubs() {
  const [clubs, setClubs] = useState(() => store.get('clubs') || []);
  const [activities, setActivities] = useState(() => store.get('clubActivities') || []);
  const [addingClub, setAddingClub] = useState(false);
  const [addingAct, setAddingAct] = useState(false);
  const [clubForm, setClubForm] = useState({ name: '', role: '', since: '' });
  const [actForm, setActForm] = useState({ clubId: '', title: '', date: new Date().toISOString().split('T')[0], hours: '', desc: '' });

  const setCF = (k, v) => setClubForm(f => ({ ...f, [k]: v }));
  const setAF = (k, v) => setActForm(f => ({ ...f, [k]: v }));

  const saveClub = () => {
    if (!clubForm.name) return;
    const u = [...clubs, { ...clubForm, id: uid() }];
    setClubs(u); store.set('clubs', u); setAddingClub(false);
    setClubForm({ name: '', role: '', since: '' });
  };

  const saveAct = () => {
    if (!actForm.title || !actForm.clubId) return;
    const u = [{ ...actForm, id: uid() }, ...activities];
    setActivities(u); store.set('clubActivities', u); setAddingAct(false);
    setActForm({ clubId: '', title: '', date: new Date().toISOString().split('T')[0], hours: '', desc: '' });
  };

  const delClub = (id) => {
    const u = clubs.filter(c => c.id !== id); setClubs(u); store.set('clubs', u);
    const ua = activities.filter(a => a.clubId !== id); setActivities(ua); store.set('clubActivities', ua);
  };

  const getClub = (id) => clubs.find(c => c.id === id);

  // Stats per club
  const clubStats = clubs.map(c => {
    const acts = activities.filter(a => a.clubId === c.id);
    const totalHours = acts.reduce((s, a) => s + (+a.hours || 0), 0);
    return { ...c, actCount: acts.length, totalHours };
  }).sort((a, b) => b.totalHours - a.totalHours);

  return (
    <div className="page-enter" style={{ padding: 20, maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Clubs & Activities</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>{clubs.length} clubs · {activities.length} activities</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" onClick={() => { setAddingAct(true); setAddingClub(false); }}><Plus size={13} /> Activity</button>
          <button className="btn btn-primary" onClick={() => { setAddingClub(true); setAddingAct(false); }}><Plus size={13} /> Club</button>
        </div>
      </div>

      {addingClub && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Add Club</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Club Name</label><input value={clubForm.name} onChange={e => setCF('name', e.target.value)} placeholder="KUET Robotics Club" /></div>
            <div><label>Your Role</label><input value={clubForm.role} onChange={e => setCF('role', e.target.value)} placeholder="Member / Secretary" /></div>
            <div><label>Member Since</label><input type="date" value={clubForm.since} onChange={e => setCF('since', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={saveClub}><Check size={13} /> Save</button>
            <button className="btn btn-ghost" onClick={() => setAddingClub(false)}><X size={13} /> Cancel</button>
          </div>
        </div>
      )}

      {addingAct && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Log Club Activity</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label>Club</label>
              <select value={actForm.clubId} onChange={e => setAF('clubId', e.target.value)}>
                <option value="">Select club</option>
                {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label>Date</label><input type="date" value={actForm.date} onChange={e => setAF('date', e.target.value)} /></div>
            <div><label>Hours Spent</label><input type="number" value={actForm.hours} onChange={e => setAF('hours', e.target.value)} placeholder="2" min={0} step={0.5} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label>Activity / Task</label><input value={actForm.title} onChange={e => setAF('title', e.target.value)} placeholder="Robotics workshop preparation" /></div>
          <div style={{ marginBottom: 10 }}><label>Details</label><textarea value={actForm.desc} onChange={e => setAF('desc', e.target.value)} rows={2} placeholder="What was done..." /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={saveAct}><Check size={13} /> Save</button>
            <button className="btn btn-ghost" onClick={() => setAddingAct(false)}><X size={13} /> Cancel</button>
          </div>
        </div>
      )}

      {/* Club cards */}
      {clubStats.length === 0 && !addingClub && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Add your clubs to start tracking activities.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 20 }}>
        {clubStats.map((c, i) => (
          <div key={c.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                {c.role && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>{c.role}</div>}
                {i === 0 && c.totalHours > 0 && <span className="tag tag-green" style={{ marginTop: 4, display: 'inline-flex' }}>Most Active</span>}
              </div>
              <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => delClub(c.id)}><Trash2 size={12} color="var(--danger)" /></button>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{c.actCount}</div>
                <div style={{ color: 'var(--muted)' }}>Activities</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{c.totalHours}</div>
                <div style={{ color: 'var(--muted)' }}>Hours</div>
              </div>
              {c.since && <div style={{ color: 'var(--muted)', alignSelf: 'flex-end', marginLeft: 'auto' }}>Since {c.since}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Recent activities */}
      {activities.length > 0 && (
        <>
          <div className="section-title">Recent Activities</div>
          {activities.slice(0, 10).map(a => {
            const c = getClub(a.clubId);
            return (
              <div key={a.id} className="card" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c?.name} · {a.date}</div>
                </div>
                {a.hours && <span className="tag tag-blue">{a.hours}h</span>}
                <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => {
                  const u = activities.filter(x => x.id !== a.id); setActivities(u); store.set('clubActivities', u);
                }}><Trash2 size={11} color="var(--danger)" /></button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
