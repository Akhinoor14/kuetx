// Teachers.jsx
//
// PHASE 2 REWRITE, REVISED (see PROMPT.md Progress Log — an earlier pass
// modeled Block 1 as per-CR personal data; the owner corrected this to
// class-wide shared, matching how courseTeacherMap/plannerSettings
// already work). Two blocks:
//
//   Block 1 — "My Current Term Teachers": groups/{groupId}/
//   teacherProfiles/{teacherId} (see crCourseTeachers.js), class-wide
//   shared — any CR/ACR of THIS group can add/edit/remove, every member
//   of THIS group (student or CR/ACR) can read. Each entry is either
//   LINKED to a real facultyDirectory record (directoryEmail set — name/
//   dept/designation/photo always read live from the cache, never
//   copied in) or fully freehand (directoryEmail null). Sorted:
//   own-department entries first, then the rest, alphabetically within
//   each group. teacherId is reused from teacherRegistry when the CR
//   picks a name already assigned to a course, so this and
//   courseTeacherMap refer to the same person under the same id.
//
//   Block 2 — "All Teachers": the full facultyDirectory, read through
//   facultyDirectoryCache.js (localStorage-cached, NOT a live
//   subscription — see that file's header for why). Department filter +
//   search box; search also cross-references facultyPublications titles
//   via the existing subscribeToAllPublications() feed.
//
// Edit controls in Block 1 are shown only to CR/ACR of this specific
// group (subscribeMyRole) — students in the same class see the exact
// same shared list, read-only. This is a client-side UI convenience
// only; the real boundary is firestore.rules' isContentEditor(groupId)
// check on the teacherProfiles subcollection.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2, X, Check, Users, Phone, Building2, Search, Link2, Star } from 'lucide-react';
import { getProfile, DEPARTMENTS, INSTITUTES, BASIC_SCIENCE_DEPTS, uid } from '../store/store';
import { getGroupId } from '../lib/groupUtils';
import { auth } from '../lib/firebase';
import { subscribeMyRole, subscribePlannerSettings } from '../lib/groupSync';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  subscribeToGroupTeachers,
  addGroupTeacher,
  updateGroupTeacher,
  deleteGroupTeacher,
} from '../lib/crCourseTeachers';
import {
  getAllFacultyDirectory,
  getFacultyDirectoryEntry,
  searchFacultyDirectory,
} from '../lib/facultyDirectoryCache';
import { subscribeToAllPublications } from '../lib/facultyPublicationsSync';
import { notify } from '../lib/notify';

const DEPT_NAME_BY_CODE = Object.fromEntries(
  [...DEPARTMENTS, ...INSTITUTES, ...BASIC_SCIENCE_DEPTS].map((d) => [d.code, d.name])
);

const EMPTY_FORM = {
  directoryEmail: null,
  name: '', initial: '', title: '', honorific: 'Sir', dept: '',
  phone: '', officeRoom: '', rating: '', notes: '', courses: '',
};

export default function Teachers() {
  const navigate = useNavigate();
  const profile = getProfile();
  const myDeptCode = profile?.dept || '';
  const groupId = getGroupId(profile);

  // Whether the signed-in user can edit Block 1 for this group — real
  // enforcement is server-side (firestore.rules isContentEditor), this
  // is purely to decide whether to show Add/Edit/Delete controls.
  const [myRole, setMyRole] = useState('member');
  const canEdit = myRole === 'cr' || myRole === 'acr';

  useEffect(() => {
    if (!groupId || !auth.currentUser?.uid) return undefined;
    return subscribeMyRole(groupId, auth.currentUser.uid, setMyRole);
  }, [groupId]);

  // teacherRegistry (from plannerSettings) — used only so that picking a
  // name-autocomplete suggestion which happens to match an
  // ALREADY-ASSIGNED course teacher reuses that same teacherId instead
  // of minting a second, disconnected profile for the same person.
  const [teacherRegistry, setTeacherRegistry] = useState({});
  useEffect(() => {
    if (!groupId) return undefined;
    return subscribePlannerSettings(groupId, (data) => setTeacherRegistry(data?.teacherRegistry || {}));
  }, [groupId]);

  // ---- Block 1: shared group teacher profiles ----
  const [groupTeachers, setGroupTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [directoryByEmail, setDirectoryByEmail] = useState({}); // resolved directory entries for linked cards

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // teacherId being edited, or null
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestDebounceRef = useRef(null);

  useEffect(() => {
    if (!groupId) { setTeachersLoading(false); return undefined; }
    const unsub = subscribeToGroupTeachers(
      groupId,
      (list) => { setGroupTeachers(list); setTeachersLoading(false); },
      () => setTeachersLoading(false)
    );
    return unsub;
  }, [groupId]);

  // Resolve directory info for every linked (directoryEmail != null)
  // entry in Block 1 — reads through the Phase 1 cache, so this is
  // effectively free once the cache is warm (no per-card Firestore read).
  useEffect(() => {
    const emails = [...new Set(groupTeachers.map((t) => t.directoryEmail).filter(Boolean))];
    if (emails.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(emails.map((email) => getFacultyDirectoryEntry(email)));
      if (cancelled) return;
      const map = {};
      emails.forEach((email, i) => { if (entries[i]) map[email] = entries[i]; });
      setDirectoryByEmail((prev) => ({ ...prev, ...map }));
    })();
    return () => { cancelled = true; };
  }, [groupTeachers]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Typing in the name field runs a debounced local search (no
  // Firestore call per keystroke — searchFacultyDirectory() is a local
  // substring match over the already-cached array) so the CR can pick a
  // real teacher and link to them instead of typing everything freehand.
  const onNameChange = (value) => {
    set('name', value);
    // Any manual retyping of the name after a match was picked reverts
    // to freehand mode — the previously-set directoryEmail no longer
    // reflects what's in the box.
    if (form.directoryEmail) set('directoryEmail', null);

    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    if (!value.trim()) { setNameSuggestions([]); setShowSuggestions(false); return; }
    suggestDebounceRef.current = setTimeout(async () => {
      const results = await searchFacultyDirectory(value);
      setNameSuggestions(results.slice(0, 6));
      setShowSuggestions(true);
    }, 250);
  };

  const pickSuggestion = (entry) => {
    setForm((f) => ({
      ...f,
      directoryEmail: entry.id,
      name: entry.name || '',
      dept: entry.department || '',
      title: entry.designation || '',
    }));
    setShowSuggestions(false);
    setNameSuggestions([]);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setNameSuggestions([]);
    setShowSuggestions(false);
  };

  // Reuse an existing teacherRegistry id if this freehand name
  // case-insensitively matches an already-registered teacher (same
  // matching convention as teacherRegistry.js's resolveTeacherIdsForNames)
  // — keeps a freehand profile and a course assignment for the same
  // person under one id instead of drifting into two records.
  const resolveTeacherIdForName = (name) => {
    const key = String(name || '').trim().toLowerCase();
    if (!key) return null;
    const match = Object.entries(teacherRegistry).find(([, regName]) => String(regName || '').trim().toLowerCase() === key);
    return match ? match[0] : null;
  };

  const save = async () => {
    const effectiveName = form.directoryEmail ? (directoryByEmail[form.directoryEmail]?.name || form.name) : form.name;
    if (!effectiveName) return;
    try {
      if (editing) {
        await updateGroupTeacher(groupId, editing, profile, form);
        notify('Teacher updated', 'success');
        setEditing(null);
      } else {
        const teacherId = resolveTeacherIdForName(effectiveName) || uid();
        // Defensive: setDoc() in addGroupTeacher would silently overwrite
        // an existing profile at this id — guard against that here (the
        // only way this id could already have a profile is a name-match
        // reuse from teacherRegistry that happens to already have a
        // profile too, which should go through Edit instead of Add).
        if (groupTeachers.some((t) => t.id === teacherId)) {
          notify('This teacher already has a profile in your class list — edit it instead of adding a new one.', 'error');
          return;
        }
        await addGroupTeacher(groupId, teacherId, profile, form);
        notify('Teacher added', 'success');
        setAdding(false);
      }
      resetForm();
    } catch (err) {
      notify(err?.message || 'Could not save teacher', 'error');
    }
  };

  const startEdit = (teacher) => {
    setForm({
      directoryEmail: teacher.directoryEmail || null,
      name: teacher.name || '', initial: teacher.initial || '', title: teacher.title || '',
      honorific: teacher.honorific || 'Sir', dept: teacher.dept || '',
      phone: teacher.phone || '', officeRoom: teacher.officeRoom || '',
      rating: teacher.rating || '', notes: teacher.notes || '', courses: teacher.courses || '',
    });
    setEditing(teacher.id);
    setAdding(false);
  };

  const del = (id) => setDeleteTarget(id);
  const confirmDelete = async () => {
    try {
      await deleteGroupTeacher(groupId, deleteTarget, profile);
      notify('Teacher removed', 'success');
    } catch (err) {
      notify(err?.message || 'Could not remove teacher', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  // Own-department entries first, then the rest, alphabetically within
  // each group — no separate filter chip, just this sort/grouping order
  // within Block 1 itself (see PROMPT.md decision #4).
  const sortedGroupTeachers = useMemo(() => {
    const resolvedDept = (t) => (t.directoryEmail ? directoryByEmail[t.directoryEmail]?.department : t.dept) || '';
    const resolvedName = (t) => (t.directoryEmail ? directoryByEmail[t.directoryEmail]?.name : t.name) || '';
    return [...groupTeachers].sort((a, b) => {
      const aOwn = resolvedDept(a) === myDeptCode ? 0 : 1;
      const bOwn = resolvedDept(b) === myDeptCode ? 0 : 1;
      if (aOwn !== bOwn) return aOwn - bOwn;
      return resolvedName(a).localeCompare(resolvedName(b));
    });
  }, [groupTeachers, directoryByEmail, myDeptCode]);

  // ---- Block 2: All Teachers (facultyDirectory, cached) ----
  const [allTeachers, setAllTeachers] = useState([]);
  const [dirLoading, setDirLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [allPubs, setAllPubs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await getAllFacultyDirectory();
      if (!cancelled) { setAllTeachers(entries); setDirLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // A second lightweight subscribeToAllPublications call here (same as
  // PublicationsBrowse.jsx's own subscription) — cheap enough not to
  // need a shared context; the Firestore cost concern in this rewrite is
  // specifically about facultyDirectory, not facultyPublications.
  useEffect(() => {
    const unsub = subscribeToAllPublications(setAllPubs, () => {});
    return unsub;
  }, []);

  const filteredAllTeachers = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    // Teachers whose publication titles match the search text, even if
    // their own name/dept/phone doesn't.
    const emailsMatchingPubTitle = text
      ? new Set(
        allPubs
          .filter((p) => (p.title || p.raw_citation || '').toLowerCase().includes(text))
          .map((p) => p.teacherEmail)
          .filter(Boolean)
      )
      : new Set();

    return allTeachers.filter((t) => {
      if (deptFilter && t.department !== deptFilter) return false;
      if (!text) return true;
      const haystack = [t.name, t.phone, t.department && DEPT_NAME_BY_CODE[t.department], t.designation]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(text) || emailsMatchingPubTitle.has(t.id);
    });
  }, [allTeachers, deptFilter, searchText, allPubs]);

  return (
    <div className="page-enter page-container content-page-bg">
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <Users size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Teachers</h1>
          </div>
          <p className="content-page-hero-subtitle">Your class's term teachers, plus the full KUET faculty directory</p>
        </div>
        {canEdit && (
          <div className="content-page-hero-actions">
            <button className="btn btn-primary" onClick={() => { setAdding(true); setEditing(null); resetForm(); }}>
              <Plus size={13} /> <span className="btn-txt">Add Teacher</span>
            </button>
          </div>
        )}
      </div>

      {/* ---------------- Block 1: My Current Term Teachers ---------------- */}
      <div style={{ fontWeight: 700, fontSize: 14, margin: '4px 0 4px' }}>My Current Term Teachers</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
        Shared with your whole class{canEdit ? ' — you can add and edit this' : ''}
      </div>

      {!groupId && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, marginBottom: 24 }}>
          <p>Set your department and batch in Profile to see your class's shared teacher list.</p>
        </div>
      )}

      {groupId && canEdit && (adding || editing) && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{editing ? 'Edit' : 'Add'} Teacher</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ position: 'relative' }}>
              <label>Full Name</label>
              <input
                value={form.name}
                onChange={(e) => onNameChange(e.target.value)}
                onFocus={() => nameSuggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Kamal Hossain"
              />
              {form.directoryEmail && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--accent)', marginTop: 3 }}>
                  <Link2 size={11} /> Linked to faculty directory
                </span>
              )}
              {showSuggestions && nameSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: 'var(--card-bg, var(--bg))', border: '1px solid var(--border)', borderRadius: 8,
                  marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 220, overflowY: 'auto',
                }}>
                  {nameSuggestions.map((s) => (
                    <div
                      key={s.id}
                      onMouseDown={() => pickSuggestion(s)}
                      style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 12.5, borderBottom: '1px solid var(--border)' }}
                    >
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                        {[s.designation, DEPT_NAME_BY_CODE[s.department] || s.department].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label>Initial</label>
              <input value={form.initial} onChange={(e) => set('initial', e.target.value)} placeholder="KH" disabled={!!form.directoryEmail} />
            </div>
            <div>
              <label>Title / Position</label>
              <input
                value={form.directoryEmail ? (directoryByEmail[form.directoryEmail]?.designation || form.title) : form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Professor"
                disabled={!!form.directoryEmail}
              />
            </div>
            <div>
              <label>Address as</label>
              <select value={form.honorific || 'Sir'} onChange={(e) => set('honorific', e.target.value)}>
                <option value="Sir">Sir</option>
                <option value="Ma'am">Ma'am</option>
              </select>
            </div>
          </div>

          {form.directoryEmail && (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
              Department: {DEPT_NAME_BY_CODE[directoryByEmail[form.directoryEmail]?.department] || directoryByEmail[form.directoryEmail]?.department || form.dept || '—'}
              {' '}(from faculty directory — read-only)
            </div>
          )}
          {!form.directoryEmail && (
            <div style={{ marginBottom: 10 }}>
              <label>Department</label>
              <input value={form.dept} onChange={(e) => set('dept', e.target.value)} placeholder="CSE" />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Phone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="017XXXXXXXX" /></div>
            <div><label>Courses (codes)</label><input value={form.courses} onChange={(e) => set('courses', e.target.value)} placeholder="CSE 2201, CSE 2202" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label>Office Room</label><input value={form.officeRoom} onChange={(e) => set('officeRoom', e.target.value)} placeholder="Acad. Bldg 302" /></div>
            <div><label>Rating (1-5)</label><input type="number" min={1} max={5} value={form.rating} onChange={(e) => set('rating', e.target.value)} placeholder="4" /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label>Notes</label><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Teaching style, tips..." /></div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={save}><Check size={13} /> Save</button>
            <button className="btn btn-ghost" onClick={() => { setAdding(false); setEditing(null); resetForm(); }}><X size={13} /> Cancel</button>
          </div>
        </div>
      )}

      {groupId && !teachersLoading && sortedGroupTeachers.length === 0 && !adding && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, marginBottom: 24 }}>
          <p>{canEdit ? 'No teachers added for this term yet.' : "Your CR hasn't added any teachers for this term yet."}</p>
        </div>
      )}

      {groupId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {sortedGroupTeachers.map((teacher) => {
            const dir = teacher.directoryEmail ? directoryByEmail[teacher.directoryEmail] : null;
            const isLinked = !!teacher.directoryEmail;
            const displayName = isLinked ? (dir?.name || teacher.directoryEmail) : teacher.name;
            const displayDept = isLinked ? dir?.department : teacher.dept;
            const displayTitle = isLinked ? dir?.designation : teacher.title;

            return (
              <div key={teacher.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {isLinked && dir?.photo_url && (
                        <img src={dir.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                      )}
                      <span
                        style={{ fontWeight: 700, fontSize: 14, cursor: isLinked ? 'pointer' : 'default', color: isLinked ? 'var(--accent)' : 'inherit' }}
                        onClick={() => isLinked && navigate(`/teachers/${teacher.directoryEmail}`)}
                      >
                        {displayName}
                      </span>
                      <span className="tag tag-green">{teacher.honorific || 'Sir'}</span>
                      {!isLinked && teacher.initial && <span className="tag tag-gray">{teacher.initial}</span>}
                      {displayTitle && <span className="tag tag-blue">{displayTitle}</span>}
                      {isLinked && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--accent)' }}>
                          <Link2 size={11} /> Linked
                        </span>
                      )}
                      {teacher.rating && (
                        <span style={{ fontSize: 11, color: 'var(--warning)', display: 'inline-flex', alignItems: 'center' }}>
                          <Star size={11} fill="currentColor" style={{ marginRight: 2 }} />{teacher.rating}/5
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
                      {displayDept && <span>{DEPT_NAME_BY_CODE[displayDept] || displayDept}</span>}
                      {teacher.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={12} />{teacher.phone}</span>}
                      {teacher.officeRoom && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Building2 size={12} />{teacher.officeRoom}</span>}
                    </div>
                    {teacher.courses && <div style={{ fontSize: 12, marginTop: 4 }}>Courses: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)' }}>{teacher.courses}</span></div>}
                    {teacher.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{teacher.notes}</div>}
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => startEdit(teacher)}><Edit2 size={12} /></button>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => del(teacher.id)}><Trash2 size={12} color="var(--danger)" /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- Block 2: All Teachers ---------------- */}
      <div style={{ fontWeight: 700, fontSize: 14, margin: '4px 0 10px' }}>All Teachers</div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--muted)' }} />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by name, phone, department, or paper title…"
            style={{
              width: '100%', padding: '10px 12px 10px 32px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', height: 40,
            }}
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          style={{
            padding: '0 10px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text)', fontSize: 13, height: 40, minWidth: 160,
          }}
        >
          <option value="">All departments</option>
          <optgroup label="Departments">
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </optgroup>
          <optgroup label="Institutes">
            {INSTITUTES.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}
          </optgroup>
          <optgroup label="Basic Sciences">
            {BASIC_SCIENCE_DEPTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </optgroup>
        </select>
      </div>

      {dirLoading ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>Loading faculty directory…</p>
        </div>
      ) : filteredAllTeachers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
          <p>No teachers match your search.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {filteredAllTeachers.map((t) => (
            <div
              key={t.id}
              className="card"
              style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}
              onClick={() => navigate(`/teachers/${t.id}`)}
            >
              {t.photo_url ? (
                <img src={t.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[t.designation, DEPT_NAME_BY_CODE[t.department] || t.department].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove teacher?"
        message="This will remove the teacher from your class's shared list. It won't affect the faculty directory."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        confirmTone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
