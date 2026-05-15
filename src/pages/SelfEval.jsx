import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { store, uid } from '../store/store';

const BAD_PRESETS = ['মিথ্যা কথা বলা', 'গালি দেওয়া', 'নামাজ মিস', 'সময় নষ্ট করা', 'অন্যকে কষ্ট দেওয়া', 'হিংসা করা'];
const GOOD_PRESETS = ['কাউকে সাহায্য করা', 'ভালো পড়াশোনা', 'সময়মতো নামাজ', 'ব্যায়াম করা', 'বই পড়া', 'সৎ কাজ করা'];

export default function SelfEval() {
  const today = new Date().toISOString().split('T')[0];
  const [records, setRecords] = useState(() => store.get('selfeval') || {});
  const [selDate, setSelDate] = useState(today);
  const [newBad, setNewBad] = useState('');
  const [newGood, setNewGood] = useState('');
  const [rating, setRating] = useState(() => (store.get('selfeval') || {})[today]?.rating || 3);

  const getRec = (d) => records[d] || { bad: [], good: [], rating: 3, note: '' };
  const rec = getRec(selDate);

  const update = (field, val) => {
    const updated = { ...records, [selDate]: { ...getRec(selDate), [field]: val } };
    setRecords(updated); store.set('selfeval', updated);
  };

  const addBad = (txt) => {
    if (!txt.trim()) return;
    update('bad', [...(rec.bad || []), { id: uid(), text: txt, ts: Date.now() }]);
    setNewBad('');
  };

  const addGood = (txt) => {
    if (!txt.trim()) return;
    update('good', [...(rec.good || []), { id: uid(), text: txt, ts: Date.now() }]);
    setNewGood('');
  };

  const removeBad = (id) => update('bad', rec.bad.filter(b => b.id !== id));
  const removeGood = (id) => update('good', rec.good.filter(g => g.id !== id));

  const setRatingVal = (v) => { setRating(v); update('rating', v); };

  const ratingLabel = ['', 'খুব খারাপ', 'খারাপ', 'ঠিক আছে', 'ভালো', 'অসাধারণ'][rec.rating || 3];

  return (
    <div className="page-enter" style={{ padding: 20, maxWidth: 680 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Self Evaluation</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Daily accountability — good deeds, bad habits, self rating</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{ width: 'auto' }} />
        <button className="btn btn-ghost" onClick={() => setSelDate(today)}>Today</button>
      </div>

      {/* Self Rating */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>আজকের দিনটা কেমন ছিল?</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          {[1, 2, 3, 4, 5].map(v => (
            <button key={v} onClick={() => setRatingVal(v)} style={{
              width: 40, height: 40, borderRadius: 8, border: '2px solid',
              borderColor: (rec.rating || 3) >= v ? 'var(--accent)' : 'var(--border)',
              background: (rec.rating || 3) >= v ? 'var(--accent)' : 'transparent',
              color: (rec.rating || 3) >= v ? 'var(--accentFg)' : 'var(--muted)',
              cursor: 'pointer', fontWeight: 700, fontSize: 15,
            }}>{v}</button>
          ))}
          <span style={{ fontSize: 13, color: 'var(--muted)', alignSelf: 'center', marginLeft: 4 }}>{ratingLabel}</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Note for today</label>
          <input value={rec.note || ''} onChange={e => update('note', e.target.value)} placeholder="আজকের কোনো ভাবনা বা সংকল্প..." />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Bad deeds */}
        <div className="card" style={{ borderTop: '3px solid var(--danger)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--danger)' }}>⚠ খারাপ কাজ</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={newBad} onChange={e => setNewBad(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBad(newBad)} placeholder="যোগ করুন..." style={{ fontSize: 12 }} />
            <button className="btn btn-danger" style={{ padding: '5px 10px', flexShrink: 0 }} onClick={() => addBad(newBad)}><Plus size={12} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {BAD_PRESETS.map(p => (
              <button key={p} onClick={() => addBad(p)} style={{
                padding: '3px 8px', borderRadius: 4, fontSize: 10, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Sora, sans-serif',
              }}>{p}</button>
            ))}
          </div>
          {(rec.bad || []).map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontSize: 12 }}>{b.text}</span>
              <button onClick={() => removeBad(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={11} /></button>
            </div>
          ))}
          {(rec.bad || []).length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>কোনো খারাপ কাজ নেই ✓</div>}
        </div>

        {/* Good deeds */}
        <div className="card" style={{ borderTop: '3px solid var(--success)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--success)' }}>✓ ভালো কাজ</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={newGood} onChange={e => setNewGood(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGood(newGood)} placeholder="যোগ করুন..." style={{ fontSize: 12 }} />
            <button className="btn btn-primary" style={{ padding: '5px 10px', flexShrink: 0 }} onClick={() => addGood(newGood)}><Plus size={12} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {GOOD_PRESETS.map(p => (
              <button key={p} onClick={() => addGood(p)} style={{
                padding: '3px 8px', borderRadius: 4, fontSize: 10, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Sora, sans-serif',
              }}>{p}</button>
            ))}
          </div>
          {(rec.good || []).map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontSize: 12 }}>{g.text}</span>
              <button onClick={() => removeGood(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Trash2 size={11} /></button>
            </div>
          ))}
          {(rec.good || []).length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>এখনো কিছু নেই</div>}
        </div>
      </div>
    </div>
  );
}
