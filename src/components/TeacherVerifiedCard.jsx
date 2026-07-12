// TeacherVerifiedCard.jsx — §9.5 of the merged Faculty Module prompt
//
// Read-only card shown to a STUDENT, listing any 'sent' marks a real
// teacher has verified for them — sits NEXT TO the existing self-reported
// Marks.jsx/Attendance.jsx fields, never overwrites or reads from them
// (§2 item 6: "existing field overwrite করবে না"). Renders nothing at all
// if the student has no active group or no sent records yet, so it's
// invisible/inert for anyone the Faculty Module hasn't touched.
//
// Used in both Marks.jsx (primary location per §9.5) and, optionally,
// Attendance.jsx — inserted via a single import + one render call in each,
// not a restructuring of either file.

import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { auth } from '../lib/firebase';
import { getGroupId } from '../lib/groupUtils';
import { subscribeMyTeacherVerifiedRecords } from '../lib/facultyMarksSync';

export default function TeacherVerifiedCard({ profile }) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const groupId = getGroupId(profile);
    if (!uid || !groupId) { setRecords([]); return; }
    return subscribeMyTeacherVerifiedRecords(groupId, uid, setRecords);
  }, [profile]);

  if (!records.length) return null;

  const totalFor = (r) => {
    const t1 = Object.values(r.teacher1Marks || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    const t2 = Object.values(r.teacher2Marks || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    return t1 + t2;
  };

  return (
    <div style={{
      marginBottom: 16, padding: 16, borderRadius: 14,
      border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--border))',
      background: 'color-mix(in srgb, var(--accent) 6%, var(--card))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <GraduationCap size={16} color="var(--accent)" />
        <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>Teacher-Verified Marks</div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {records.map((r) => (
          <div key={r.assignmentId} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            padding: '10px 12px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>
                {r.courseCode}{r.courseTitle ? ` — ${r.courseTitle}` : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.courseType}</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>{totalFor(r)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 8 }}>
        Confirmed by your course teacher(s) — separate from your own self-tracked estimate above.
      </div>
    </div>
  );
}
