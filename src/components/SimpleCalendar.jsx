import { useMemo, useState, useRef, useEffect } from 'react';

function parseISO(s){ if (s instanceof Date) return s; return new Date(s + 'T00:00:00'); }
function formatISO(d){ return d.toISOString().slice(0,10); }

function monthGrid(year, month){
  // month: 0-11
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay(); // 0=Sun
  const days = [];
  // grid starts from Sunday of the week containing 1st
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - startDay);
  for(let i=0;i<42;i++){ const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); days.push(d); }
  const weeks = [];
  for(let w=0; w<6; w++){ weeks.push(days.slice(w*7, w*7+7)); }
  return weeks;
}

export default function SimpleCalendar({ events = [], onEventChange }){
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const longPressRef = useRef(null);

  // normalize events: ensure start/end ISO strings
  const normalized = useMemo(()=>{
    return (events||[]).map(e=>({ ...e, start: formatISO(parseISO(e.start)), end: e.end ? formatISO(parseISO(e.end)) : null }));
  }, [events]);

  const grid = useMemo(()=> monthGrid(year, month), [year, month]);

  // helper: find events for a date (inclusive for multi-day)
  function eventsForDate(dateStr){
    return normalized.filter(ev => {
      const s = ev.start;
      const e = ev.end || ev.start;
      return (s <= dateStr && dateStr <= e);
    });
  }

  function prev(){ if (month===0){ setMonth(11); setYear(year-1); } else setMonth(m=>m-1); }
  function next(){ if (month===11){ setMonth(0); setYear(year+1); } else setMonth(m=>m+1); }

  useEffect(()=>{ longPressRef.current = {}; }, []);

  if (!events || events.length===0) return <div style={{ padding: 12, color: 'var(--muted)' }}>No scheduled CTs or quizzes to show.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
        <div style={{ fontWeight:800 }}>{year} · {String(month+1).padStart(2,'0')}</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost" onClick={prev}>Prev</button>
          <button className="btn btn-ghost" onClick={next}>Next</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, background: 'transparent' }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=> (<div key={d} style={{ textAlign:'center', fontWeight:700 }}>{d}</div>))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {grid.flat().map(d=>{
          const dateStr = formatISO(d);
          const inMonth = d.getMonth() === month;
          const evs = eventsForDate(dateStr);
          return (
            <div key={dateStr} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
              const id = e.dataTransfer.getData('text/event-id');
              if (!id) return;
              const ev = events.find(x=> (x.id || `${x.title}-${x.start}`) === id);
              if (!ev) return;
              onEventChange && onEventChange({ ...ev, start: dateStr }, 'drop');
            }} style={{ minHeight: 90, borderRadius: 8, padding: 8, background: inMonth? 'var(--surface)': 'rgba(0,0,0,0.02)', border: '1px solid var(--border)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{d.getDate()}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{inMonth? '' : ' '}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {evs.slice(0,3).map(ev=>{
                  const id = ev.id || `${ev.title}-${ev.start}`;
                  const span = (()=>{ if (!ev.end) return 1; const s = parseISO(ev.start); const e = parseISO(ev.end); return Math.max(1, Math.ceil((e - s)/(1000*60*60*24))+1); })();
                  return (
                    <div key={id} draggable onDragStart={(e)=>e.dataTransfer.setData('text/event-id', id)} onTouchStart={(ev)=>{
                      const t = setTimeout(()=>{ const v = prompt('Long press detected. Change date (YYYY-MM-DD)', dateStr); if (v) onEventChange && onEventChange({ ...ev, start: v }, 'edit'); }, 600);
                      longPressRef.current[id] = t;
                    }} onTouchEnd={(ev)=>{ const t = longPressRef.current[id]; if (t) clearTimeout(t); longPressRef.current[id]=null; }} style={{ background: 'linear-gradient(90deg, #eef2ff, #e6ffef)', padding: '4px 8px', borderRadius: 6, fontSize: 12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:700 }}>{ev.title}</div>
                      <div style={{ marginLeft:8, fontSize:11, color:'var(--muted)' }}>{span>1?`${span}d`:''}</div>
                    </div>
                  );
                })}
                {evs.length>3 && <div style={{ color:'var(--muted)', fontSize:12 }}><button className="btn btn-ghost" onClick={()=> alert(evs.map(e=>e.title).join('\n'))}>+{evs.length-3} more</button></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
