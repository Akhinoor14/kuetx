import { useEffect, useState } from 'react';
import { getProfile } from '../store/store';
import SimpleCalendar from '../components/SimpleCalendar';

export default function CTQuizManagement() {
  const profile = getProfile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('balanced');
  const [editing, setEditing] = useState(null); // course being edited

  useEffect(() => {
    fetchSchedule();
  }, []);

  async function fetchSchedule() {
    setLoading(true);
    try {
      const res = await fetch('/generated_schedule.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('No generated schedule found');
      const j = await res.json();
      // apply overrides from localStorage
      try {
        const raw = localStorage.getItem('ct_schedule_overrides');
        if (raw) {
          const overrides = JSON.parse(raw);
          (j.courses || []).forEach(c => {
            if (overrides[c.courseId]) {
              const o = overrides[c.courseId];
              if (o.ctList) c.ctList = o.ctList;
              if (o.quizList) c.quizList = o.quizList;
              c._locked = o._locked || false;
            }
          });
        }
      } catch (e) {
        console.warn('Failed to apply overrides', e);
      }
      setData(j);
    } catch (err) {
      // fallback: use embedded sample so page still works offline
      console.warn('Failed to load generated_schedule.json, using local sample. Error:', err);
      const sample = {
        term: 'T2026S1', generated_at: (new Date()).toISOString().slice(0,10), courses: [
          { courseId: 'CSE101', title: 'Intro to CS', ctList: [{ type: 'CT1', date: '2026-09-15', owners: ['tA'] }, { type: 'CT2', date: '2026-10-05', owners: ['tB'] }, { type: 'CT3', date: '2026-10-25', owners: ['tA','tB'] }], quizList: [], warnings: [] },
          { courseId: 'PHY201L', title: 'Physics Lab', ctList: [], quizList: [{ type: 'LabQuiz', date: '2026-11-23' }], warnings: [] }
        ]
      };
      setData(sample);
    } finally {
      setLoading(false);
    }
  }

  function downloadICS() {
    if (!data) return;
    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//KUETx//CTSchedule//EN\r\n';
    data.courses.forEach(c => {
      (c.ctList || []).forEach(ct => {
        const dt = ct.date.replace(/-/g, '') + 'T090000';
        ics += `BEGIN:VEVENT\r\nUID:${c.courseId}-${ct.type}-${ct.date}\r\nDTSTAMP:${dt}Z\r\nDTSTART:${dt}Z\r\nSUMMARY:${c.courseId} ${ct.type}\r\nEND:VEVENT\r\n`;
      });
      (c.quizList || []).forEach(q => {
        const dt = q.date.replace(/-/g, '') + 'T090000';
        ics += `BEGIN:VEVENT\r\nUID:${c.courseId}-${q.type}-${q.date}\r\nDTSTAMP:${dt}Z\r\nDTSTART:${dt}Z\r\nSUMMARY:${c.courseId} ${q.type}\r\nEND:VEVENT\r\n`;
      });
    });
    ics += 'END:VCALENDAR\r\n';
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kuetx_ct_schedule_${data.term || 'term'}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Offline-safe save: persist to localStorage and download JSON
  async function persistToServer() {
    if (!data) return alert('No schedule to save');
    try {
      const key = 'saved_schedule_local';
      localStorage.setItem(key, JSON.stringify(data));
      // also offer download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `kuetx_schedule_${data.term||'term'}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      alert('Saved locally (localStorage) and downloaded JSON');
    } catch (e) { alert('Save failed: ' + e.message); }
  }

  // Offline-friendly publish: mark as published in localStorage and download a published snapshot
  async function publishSchedule() {
    if (!data) return alert('No schedule to publish');
    try {
      const payload = { publishedAt: new Date().toISOString(), payload: data };
      localStorage.setItem('published_schedule_local', JSON.stringify(payload));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `kuetx_published_schedule_${data.term||'term'}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      alert('Published locally and downloaded snapshot');
    } catch (e) { alert('Publish failed: ' + e.message); }
  }

  function showRunCommand() {
    // Inform user how to regenerate schedule (runs on dev machine)
    alert('To regenerate the schedule run:\n\nnode "scripts/demo_schedule_generator.cjs"\n\nThen click Reload on this page.');
  }

  return (
    <div className="page-enter page-container" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>CT Quiz Management</h2>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Profile: {profile.name || '—'} {profile.isCR ? '· Class Rep' : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={model} onChange={e=>setModel(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8 }}>
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="distributed">Distributed</option>
          </select>
          <button className="btn btn-ghost" onClick={showRunCommand}>Regenerate</button>
          <button className="btn" onClick={fetchSchedule} disabled={loading}>{loading? 'Reloading...':'Reload'}</button>
          <button className="btn btn-primary" onClick={downloadICS} disabled={!data}>Export ICS</button>
          <button className="btn btn-success" onClick={persistToServer} disabled={!data}>Save to Server</button>
          <button className="btn btn-warning" onClick={publishSchedule} disabled={!data}>Publish</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
        <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Schedule Summary</div>
          {loading && <div style={{ color: 'var(--muted)' }}>Loading schedule…</div>}
          {!loading && !data && <div style={{ color: 'var(--muted)' }}>No schedule available</div>}
          {!loading && data && data.error && <div style={{ color: 'var(--danger)' }}>{data.error}</div>}

          {!loading && data && !data.error && (
            <>
              <div style={{ marginBottom: 8, color: 'var(--muted)' }}>Term: <strong>{data.term}</strong></div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Warnings</div>
              <div style={{ maxHeight: 160, overflow: 'auto', paddingRight: 6 }}>
                {data.courses.flatMap(c => (c.warnings||[]).map(w=> `${c.courseId}: ${w}`)).length === 0 && <div style={{ color: 'var(--muted)' }}>No warnings</div>}
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {data.courses.flatMap(c => (c.warnings||[]).map((w,i)=> <li key={`${c.courseId}-w-${i}`}>{c.courseId}: {w}</li>))}
                </ul>
              </div>

              <div style={{ marginTop: 10, fontWeight: 700 }}>Courses</div>
              <div style={{ maxHeight: 300, overflow: 'auto', marginTop: 8 }}>
                {data.courses.map(c => (
                  <div key={c.courseId} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8 }}>
                    <div style={{ fontWeight: 800 }}>{c.courseId} · {c.title || ''}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>CTs: {(c.ctList||[]).length} · Quizzes: {(c.quizList||[]).length}</div>
                    <div style={{ marginTop: 8 }}>
                      {(c.ctList||[]).map(ct => (
                        <div key={ct.type} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <div>{ct.type} — <strong>{ct.date}</strong></div>
                          <div style={{ color: 'var(--muted)', fontSize: 13 }}>{(ct.owners||[]).join(', ')}</div>
                        </div>
                      ))}
                      {(c.quizList||[]).map(q => (
                        <div key={q.type} style={{ marginTop: 6, color: '#106600' }}>{q.type} — <strong>{q.date}</strong></div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost" onClick={()=>setEditing(c)}>Edit</button>
                      <button className="btn btn-ghost" onClick={()=>{
                        // toggle lock and persist
                        const newData = {...data};
                        newData.courses = newData.courses.map(cc => {
                          if (cc.courseId === c.courseId) {
                            const copy = {...cc, _locked: !cc._locked};
                            // persist as override
                            const raw = localStorage.getItem('ct_schedule_overrides');
                            const overrides = raw? JSON.parse(raw): {};
                            overrides[cc.courseId] = overrides[cc.courseId] || {};
                            overrides[cc.courseId]._locked = copy._locked;
                            localStorage.setItem('ct_schedule_overrides', JSON.stringify(overrides));
                            return copy;
                          }
                          return cc;
                        });
                        setData(newData);
                      }}>{c._locked ? 'Unlock' : 'Lock'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ minHeight: 520 }}>
          <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', height: '100%' }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Calendar Editor</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>Drag & drop to reschedule. Click an event to edit date.</div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                <SimpleCalendar events={data ? data.courses.flatMap(c => [ ...(c.ctList||[]).map(ct=>({ id: `${c.courseId}-${ct.type}`, title: `${c.courseId} ${ct.type}`, start: ct.date })), ...(c.quizList||[]).map(q=>({ id: `${c.courseId}-${q.type}`, title: `${c.courseId} ${q.type}`, start: q.date })) ]) : []} onEventChange={(ev)=>{
                  if (!data) return;
                  const newData = {...data};
                  newData.courses = newData.courses.map(c => {
                    const changed = {...c};
                    changed.ctList = (changed.ctList||[]).map(x => ({...x}));
                    changed.quizList = (changed.quizList||[]).map(x=>({...x}));
                    changed.ctList = changed.ctList.map(x => {
                      if ((c.courseId + '-' + x.type) === ev.id) return {...x, date: ev.start};
                      return x;
                    });
                    changed.quizList = changed.quizList.map(x => {
                      if ((c.courseId + '-' + x.type) === ev.id) return {...x, date: ev.start};
                      return x;
                    });
                    return changed;
                  });
                  setData(newData);
                  const raw = localStorage.getItem('ct_schedule_overrides');
                  const overrides = raw? JSON.parse(raw): {};
                  newData.courses.forEach(c=>{ overrides[c.courseId] = { ctList: c.ctList, quizList: c.quizList, _locked: c._locked||false }; });
                  localStorage.setItem('ct_schedule_overrides', JSON.stringify(overrides));
                }} />
              </div>
          </div>
        </div>
      </div>
        {/* Edit modal */}
        {editing && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
            <div style={{ width: 760, maxHeight: '80vh', overflow: 'auto', background: 'var(--surface)', padding: 18, borderRadius: 12, border: '1px solid var(--border)' }}>
              <h3 style={{ marginTop: 0 }}>{editing.courseId} · Edit Schedule</h3>
              <div style={{ color: 'var(--muted)', marginBottom: 12 }}>Change dates or lock items. Dates must be YYYY-MM-DD.</div>
              <div>
                <div style={{ fontWeight: 800 }}>CTs</div>
                {(editing.ctList || []).map((ct, idx)=> (
                  <div key={ct.type} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <div style={{ width: 90 }}>{ct.type}</div>
                    <input defaultValue={ct.date} onChange={e=>{
                      const v = e.target.value;
                      setEditing(prev=>{
                        const copy = {...prev}; copy.ctList = copy.ctList.map(x => x.type===ct.type ? {...x, date:v}: x); return copy;
                      });
                    }} style={{ padding: '6px 8px', borderRadius: 6 }} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800 }}>Quizzes</div>
                {(editing.quizList || []).map((q, idx)=> (
                  <div key={q.type} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <div style={{ width: 90 }}>{q.type}</div>
                    <input defaultValue={q.date} onChange={e=>{
                      const v = e.target.value;
                      setEditing(prev=>{
                        const copy = {...prev}; copy.quizList = copy.quizList.map(x => x.type===q.type ? {...x, date:v}: x); return copy;
                      });
                    }} style={{ padding: '6px 8px', borderRadius: 6 }} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button className="btn" onClick={()=>{
                  // persist edits into data and localStorage overrides
                  const newData = {...data};
                  newData.courses = newData.courses.map(cc => cc.courseId===editing.courseId ? editing : cc);
                  setData(newData);
                  // save override
                  const raw = localStorage.getItem('ct_schedule_overrides');
                  const overrides = raw? JSON.parse(raw): {};
                  overrides[editing.courseId] = { ctList: editing.ctList, quizList: editing.quizList, _locked: editing._locked || false };
                  localStorage.setItem('ct_schedule_overrides', JSON.stringify(overrides));
                  setEditing(null);
                }}>Save</button>
                <button className="btn btn-ghost" onClick={()=>setEditing(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
