import React from 'react';
import Modal from '../components/Modal';

export default function EventModal({ open, data, courses = [], teachersMap = {}, onChange, onSave, onCancel }) {
  if (!open) return null;
  return (
    <Modal onClose={onCancel} contentStyle={{ width: 560, maxWidth: '100%', background: 'white', borderRadius: 12, padding: 18, boxShadow: '0 10px 40px rgba(2,6,23,0.4)', pointerEvents: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ width: '100%', background: 'transparent', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 800 }}>Add / Edit Event</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{data?.date || ''}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select value={data.type || 'CT'} onChange={e => onChange({ ...data, type: e.target.value })} style={{ minHeight: 40 }}>
            <option value="CT">CT</option>
            <option value="Quiz">Quiz</option>
          </select>

          <div style={{ position: 'relative' }}>
            <input list="course-list" placeholder="Course (search)" value={data.courseCode || ''} onChange={e => {
              const code = e.target.value;
              const found = courses.find(c => c.code === code || c.id === code);
              onChange({ ...data, courseId: found?.id || '', courseCode: code });
            }} style={{ minHeight: 40, width: '100%' }} />
            <datalist id="course-list">
              {courses.map(c => <option key={c.id} value={`${c.code}`} />)}
            </datalist>
          </div>

          <input placeholder="Title" value={data.title || ''} onChange={e => onChange({ ...data, title: e.target.value })} />
          <select value={data.teacher || ''} onChange={e => onChange({ ...data, teacher: e.target.value })}>
            <option value="">Teacher (optional)</option>
            {(teachersMap?.[data.courseId] || []).map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <input placeholder="Building" value={data.building || ''} onChange={e => onChange({ ...data, building: e.target.value })} />
          <input placeholder="Room" value={data.room || ''} onChange={e => onChange({ ...data, room: e.target.value })} />

          <input placeholder="Start time (e.g. 10:00 AM)" value={data.startTime || ''} onChange={e => onChange({ ...data, startTime: e.target.value })} />
          <input placeholder="End time" value={data.endTime || ''} onChange={e => onChange({ ...data, endTime: e.target.value })} />

          <input placeholder="CT Number" value={data.ctNumber || ''} onChange={e => onChange({ ...data, ctNumber: e.target.value })} />
          <input placeholder="Notes" value={data.note || ''} onChange={e => onChange({ ...data, note: e.target.value })} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onCancel} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8 }}>Cancel</button>
          <button onClick={() => onSave(data)} style={{ padding: '8px 12px', background: '#6366f1', color: 'white', borderRadius: 8 }}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
