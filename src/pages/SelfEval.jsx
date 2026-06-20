import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { store, uid } from '../store/store';

const BAD_PRESETS = ['মিথ্যা কথা বলা', 'গালি দেওয়া', 'নামাজ মিস', 'সময় নষ্ট করা', 'অন্যকে কষ্ট দেওয়া', 'হিংসা করা'];
const GOOD_PRESETS = ['কাউকে সাহায্য করা', 'ভালো পড়াশোনা', 'সময়মতো নামাজ', 'ব্যায়াম করা', 'বই পড়া', 'সৎ কাজ করা'];

export default function SelfEval() {
  const _td = new Date(); const today = `${_td.getFullYear()}-${String(_td.getMonth()+1).padStart(2,'0')}-${String(_td.getDate()).padStart(2,'0')}`;
  const [records, setRecords] = useState(() => store.get('selfeval') || {});
  const [selDate, setSelDate] = useState(today);
  const [newBad, setNewBad] = useState('');
  const [newGood, setNewGood] = useState('');
  const [rating, setRating] = useState(() => (store.get('selfeval') || {})[today]?.rating || 3);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [saveTick, setSaveTick] = useState(0);

  const getRec = (d) => records[d] || { bad: [], good: [], rating: 3, note: '' };
  const rec = getRec(selDate);

  const update = (field, val) => {
    const updated = { ...records, [selDate]: { ...getRec(selDate), [field]: val } };
    setRecords(updated);
    store.set('selfeval', updated);
    setSaveStatus('Saving...');
    setSaveTick(Date.now());
  };

  useEffect(() => {
    if (!saveTick) return;
    setSaveStatus('Saved');
    setShowSavedToast(true);
    const timer = setTimeout(() => setShowSavedToast(false), 1800);
    return () => clearTimeout(timer);
  }, [saveTick]);

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
    <div className="page-enter page-container self-eval-page">
      {showSavedToast && (
        <div className="selfeval-toast">
          ✓ Self Evaluation {saveStatus}
        </div>
      )}
      <div className="selfeval-header">
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Self Evaluation</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>Daily accountability — good deeds, bad habits, self rating</p>
      </div>

      <div className="selfeval-toolbar">
        <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{ width: 'auto' }} />
        <button className="btn btn-ghost" onClick={() => setSelDate(today)}>Today</button>
        <span className="tag tag-green" style={{ fontSize: 11 }}>{saveStatus}</span>
      </div>

      {/* Self Rating */}
      <div className="card selfeval-rating-card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>আজকের দিনটা কেমন ছিল?</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5].map(v => (
            <button key={v} className="rating-btn" onClick={() => setRatingVal(v)} style={{
              width: 36, height: 36, borderRadius: 6, border: '2px solid',
              borderColor: (rec.rating || 3) >= v ? 'var(--accent)' : 'var(--border)',
              background: (rec.rating || 3) >= v ? 'var(--accent)' : 'transparent',
              color: (rec.rating || 3) >= v ? 'var(--accentFg)' : 'var(--muted)',
              cursor: 'pointer', fontWeight: 700, fontSize: 13,
            }}>{v}</button>
          ))}
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginLeft: 8 }}>{ratingLabel}</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>Note for today</label>
          <input value={rec.note || ''} onChange={e => update('note', e.target.value)} placeholder="আজকের কোনো ভাবনা বা সংকল্প..." style={{ fontSize: 14, padding: '10px 12px', minHeight: '40px' }} />
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Auto-saves on every change, so SmartScore updates immediately.</div>
          <button className="btn btn-primary" onClick={() => { setSaveStatus('Saving...'); setSaveTick(Date.now()); }}>Save now</button>
        </div>
      </div>

      <div className="selfeval-columns">
        {/* Bad deeds */}
        <div className="card selfeval-panel selfeval-panel-bad">
          <div className="selfeval-panel-title selfeval-panel-title-bad">⚠ খারাপ কাজ</div>
          <div className="selfeval-add-row">
            <input value={newBad} onChange={e => setNewBad(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBad(newBad)} placeholder="যোগ করুন..." />
            <button className="btn btn-danger selfeval-add-btn" onClick={() => addBad(newBad)}><Plus size={14} /></button>
          </div>
          <div className="selfeval-preset-group">
            {BAD_PRESETS.map(p => (
              <button key={p} className="selfeval-chip selfeval-chip-bad" onClick={() => addBad(p)}>{p}</button>
            ))}
          </div>
          <div className="selfeval-list">
            {(rec.bad || []).map(b => (
              <div key={b.id} className="selfeval-list-item">
                <span>{b.text}</span>
                <button onClick={() => removeBad(b.id)} className="selfeval-remove-btn selfeval-remove-btn-bad"><Trash2 size={13} /></button>
              </div>
            ))}
            {(rec.bad || []).length === 0 && <div className="selfeval-empty selfeval-empty-bad">কোনো খারাপ কাজ নেই ✓</div>}
          </div>
        </div>

        {/* Good deeds */}
        <div className="card selfeval-panel selfeval-panel-good">
          <div className="selfeval-panel-title selfeval-panel-title-good">✓ ভালো কাজ</div>
          <div className="selfeval-add-row">
            <input value={newGood} onChange={e => setNewGood(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGood(newGood)} placeholder="যোগ করুন..." />
            <button className="btn btn-primary selfeval-add-btn" onClick={() => addGood(newGood)}><Plus size={14} /></button>
          </div>
          <div className="selfeval-preset-group">
            {GOOD_PRESETS.map(p => (
              <button key={p} className="selfeval-chip selfeval-chip-good" onClick={() => addGood(p)}>{p}</button>
            ))}
          </div>
          <div className="selfeval-list">
            {(rec.good || []).map(g => (
              <div key={g.id} className="selfeval-list-item">
                <span>{g.text}</span>
                <button onClick={() => removeGood(g.id)} className="selfeval-remove-btn selfeval-remove-btn-good"><Trash2 size={13} /></button>
              </div>
            ))}
            {(rec.good || []).length === 0 && <div className="selfeval-empty selfeval-empty-good">এখনো কিছু নেই</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
