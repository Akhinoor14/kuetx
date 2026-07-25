import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, FileText, Upload, Search,
  BookOpen, AlertCircle, RefreshCw, ExternalLink, Sparkles, Trash2,
} from 'lucide-react';
import { QB_DEPARTMENTS } from '../data/questionbank/questionBankData';
import { QB_COURSE_CODES } from '../data/questionbank/qbCourseCodes';
import { useQuestionBankData, getR2FileUrl } from '../hooks/useQuestionBankData';
import UploadQuestionModal from '../components/UploadQuestionModal';
import { getProfile } from '../store/store';
import { auth } from '../lib/firebase';
import { checkIsAdmin } from '../lib/adminAuth';
import { subscribeMyRoles } from '../lib/staffSync';
import { founderDeletePapers, submitDeleteRequest } from '../lib/deleteRequests';
import { notify } from '../lib/notify';

const TERMS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

function termLabel(term) {
  // "Y2T1" -> "2nd Year 1st Term"
  const yMap = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };
  const tMap = { 1: '1st', 2: '2nd' };
  const y = term[1];
  const t = term[3];
  return `${yMap[y] || y} Year ${tMap[t] || t} Term`;
}

// Screens: 'depts' -> 'terms' -> 'courses' -> 'papers'
export default function QuestionBank() {
  const navigate = useNavigate();
  const { tree, loading, error, refetch } = useQuestionBankData();

  const profile = useMemo(() => getProfile(), []);
  const myDept = profile?.dept && QB_DEPARTMENTS[profile.dept] ? profile.dept : null;
  const myTermMatch = profile?.currentTermKey?.match(/^Y\dT\d$/);
  const myTerm = myTermMatch ? profile.currentTermKey : null;

  const [screen, setScreen] = useState('depts');
  const [dept, setDept] = useState(null);
  const [term, setTerm] = useState(null);
  const [course, setCourse] = useState(null); // { code, title }
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  // Delete UI: Founder gets an immediate "Delete" per paper (no review
  // step, matching Founder uploads); a Campus Lead / Senior Campus Lead
  // of the paper's OWN dept gets "Request deletion" instead, which lands
  // in the same deleteRequests queue Founder/SCL already review from
  // StaffDashboard/AdminDashboard (see deleteRequests.js).
  const [isFounder, setIsFounder] = useState(false);
  const [myRoles, setMyRoles] = useState([]);
  const [deleteBusyKey, setDeleteBusyKey] = useState(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState(null);
  const [requestDeleteKey, setRequestDeleteKey] = useState(null);

  useEffect(() => {
    checkIsAdmin(auth.currentUser?.uid).then(setIsFounder);
  }, []);
  useEffect(() => subscribeMyRoles(setMyRoles), []);

  // The CL/SCL group scoped to this paper's dept, if the signed-in user
  // holds one — used both to show "Request deletion" and to fill in the
  // groupId submitDeleteRequest() needs.
  function myGroupIdForDept(paperDept) {
    const cl = myRoles.find((r) => r.role === 'campus_lead' && r.scope?.groupId?.endsWith(`_${paperDept}`));
    if (cl) return cl.scope.groupId;
    const scl = myRoles.find((r) => r.role === 'senior_campus_lead' && r.scope?.dept === paperDept);
    if (scl) {
      // SCL scope is dept-only (no single groupId) — fall back to the
      // signed-in user's own profile groupId if it happens to match this
      // dept, otherwise use a dept-level placeholder groupId so the
      // request doc still records which dept it's for.
      const myProfile = getProfile();
      if (myProfile?.dept && QB_DEPARTMENTS[paperDept]) return `${myProfile.batch || 'scl'}_${paperDept}`;
    }
    return null;
  }
  function canManageDept(paperDept) {
    if (isFounder) return true;
    return Boolean(myGroupIdForDept(paperDept));
  }

  const deptList = useMemo(
    () => Object.entries(QB_DEPARTMENTS).map(([code, name]) => ({ code, name })),
    []
  );

  const filteredDepts = useMemo(() => {
    if (!search.trim()) return deptList;
    const q = search.toLowerCase();
    return deptList.filter(
      (d) => d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
    );
  }, [deptList, search]);

  // Course list for the selected dept+term: curriculum data (Theory only) MERGED
  // with any course codes that actually exist in the live R2 tree. This matters
  // because (a) 4 depts have no curriculum data at all, and (b) curriculum data
  // could be incomplete/wrong for the other 12 - in either case, if a paper was
  // uploaded under some course code, it must still be browsable here.
  const courseList = useMemo(() => {
    if (!dept || !term) return [];
    const fromCurriculum = QB_COURSE_CODES[dept]?.[term] || [];
    const knownCodes = new Set(fromCurriculum.map((c) => c.code.replace(/\s+/g, '')));

    const fromR2 = Object.keys(tree?.[dept]?.[term] || {})
      .filter((courseKey) => !knownCodes.has(courseKey))
      .map((courseKey) => ({ code: courseKey, title: '(uploaded, not in curriculum list)' }));

    return [...fromCurriculum, ...fromR2];
  }, [dept, term, tree]);

  const hasCurriculumData = dept ? Boolean(QB_COURSE_CODES[dept]) : true;

  // Papers for the selected course, pulled from the live R2 tree.
  const papers = useMemo(() => {
    if (!dept || !term || !course) return [];
    const courseKey = course.code.replace(/\s+/g, '');
    return tree?.[dept]?.[term]?.[courseKey] || [];
  }, [tree, dept, term, course]);

  function goToDept(d) {
    setDept(d.code);
    setScreen('terms');
  }
  function jumpToMyTerm() {
    if (!myDept || !myTerm) return;
    setDept(myDept);
    setTerm(myTerm);
    setScreen('courses');
  }
  function goToTerm(t) {
    setTerm(t);
    setScreen('courses');
  }
  function goToCourse(c) {
    setCourse(c);
    setScreen('papers');
  }
  function goBack() {
    if (screen === 'papers') { setCourse(null); setScreen('courses'); }
    else if (screen === 'courses') { setTerm(null); setScreen('terms'); }
    else if (screen === 'terms') { setDept(null); setScreen('depts'); }
  }

  function openPaper(paper) {
    const url = getR2FileUrl(paper.key);
    navigate(`/question-bank/view?src=${encodeURIComponent(url)}&title=${encodeURIComponent(paper.label)}`);
  }

  async function handleFounderDelete(paper) {
    setDeleteBusyKey(paper.key);
    try {
      const { deleted, notFound } = await founderDeletePapers([paper.key]);
      if (deleted.includes(paper.key)) {
        notify(`Deleted "${paper.label}".`, 'success');
        refetch();
      } else if (notFound.includes(paper.key)) {
        notify('That file was already gone — refreshing the list.', 'info');
        refetch();
      } else {
        notify('Delete did not complete — try again.', 'error');
      }
    } catch (e) {
      notify(e?.message || 'Failed to delete — try again.', 'error');
    } finally {
      setDeleteBusyKey(null);
      setConfirmDeleteKey(null);
    }
  }

  async function handleRequestDelete(paper) {
    const paperGroupId = myGroupIdForDept(dept);
    if (!paperGroupId) {
      notify('Could not determine your class/department scope for this request.', 'error');
      return;
    }
    setDeleteBusyKey(paper.key);
    try {
      await submitDeleteRequest(
        { groupId: paperGroupId, dept },
        [{ key: paper.key, dept, term, courseCode: course?.code, label: paper.label }]
      );
      notify('Delete request submitted — awaiting Founder approval.', 'success');
    } catch (e) {
      notify(e?.message || 'Failed to submit delete request.', 'error');
    } finally {
      setDeleteBusyKey(null);
      setRequestDeleteKey(null);
    }
  }

  return (
    <div className="page-enter content-page-bg" style={styles.page}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <BookOpen size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {screen === 'depts' && 'Question Bank'}
              {screen === 'terms' && QB_DEPARTMENTS[dept]}
              {screen === 'courses' && `${dept} — ${termLabel(term)}`}
              {screen === 'papers' && `${course.code} — ${course.title}`}
            </h1>
          </div>
          <p className="content-page-hero-subtitle">Browse and upload past papers by department, term and course</p>
        </div>
        <div className="content-page-hero-actions">
          {screen !== 'depts' && (
            <button style={styles.backBtn} onClick={goBack}>
              <ChevronLeft size={18} /> Back
            </button>
          )}
          <button className="accent-fill-glass" style={styles.uploadBtn} onClick={() => setShowUpload(true)}>
            <Upload size={16} /> Upload
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.errorBox}>
          <AlertCircle size={16} />
          <span>Couldn't load live data: {error}</span>
          <button style={styles.retryBtn} onClick={refetch}><RefreshCw size={14} /> Retry</button>
        </div>
      )}

      {/* DEPT LIST */}
      {screen === 'depts' && (
        <>
          {myDept && myTerm && (
            <button className="accent-fill-glass" style={styles.jumpCard} onClick={jumpToMyTerm}>
              <Sparkles size={18} />
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Jump to my term</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {myDept} — {termLabel(myTerm)}
                </div>
              </div>
              <ChevronRight size={18} />
            </button>
          )}
          <div style={styles.searchWrap}>
            <Search size={16} style={{ opacity: 0.5 }} />
            <input
              style={styles.searchInput}
              placeholder="Search department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={styles.grid}>
            {filteredDepts.map((d) => (
              <button key={d.code} style={styles.card} onClick={() => goToDept(d)}>
                <div style={styles.cardCode}>{d.code}</div>
                <div style={styles.cardSub}>{d.name.replace('Department of ', '')}</div>
                <ChevronRight size={16} style={styles.cardArrow} />
              </button>
            ))}
          </div>
        </>
      )}

      {/* TERM LIST */}
      {screen === 'terms' && (
        <div style={styles.grid}>
          {TERMS.map((t) => (
            <button key={t} style={styles.card} onClick={() => goToTerm(t)}>
              <div style={styles.cardCode}>{t}</div>
              <div style={styles.cardSub}>{termLabel(t)}</div>
              <ChevronRight size={16} style={styles.cardArrow} />
            </button>
          ))}
        </div>
      )}

      {/* COURSE LIST */}
      {screen === 'courses' && (
        <>
          {!hasCurriculumData && courseList.length === 0 && (
            <div style={styles.infoBox}>
              <AlertCircle size={16} />
              <span>
                No course list or uploaded papers found yet for this department. Use "Upload" and
                type the course code manually — it'll show up here once uploaded.
              </span>
            </div>
          )}
          {!hasCurriculumData && courseList.length > 0 && (
            <div style={styles.infoBox}>
              <AlertCircle size={16} />
              <span>
                This department's course list isn't in our curriculum data yet, so only courses
                with uploaded papers are shown below. Use "Upload" to add more.
              </span>
            </div>
          )}
          {hasCurriculumData && courseList.length === 0 && (
            <div style={styles.infoBox}>
              <AlertCircle size={16} />
              <span>No theory courses found for this term.</span>
            </div>
          )}
          <div style={styles.list}>
            {courseList.map((c) => {
              const courseKey = c.code.replace(/\s+/g, '');
              const coursePapers = tree?.[dept]?.[term]?.[courseKey];
              const paperCount = coursePapers ? coursePapers.length : 0;
              return (
                <button key={c.code} style={styles.listItem} onClick={() => goToCourse(c)}>
                  <div>
                    <div style={styles.listItemCode}>{c.code}</div>
                    <div style={styles.listItemTitle}>{c.title}</div>
                  </div>
                  <div style={styles.listItemRight}>
                    {paperCount > 0 && (
                      <span style={styles.paperBadge}>{paperCount} paper{paperCount > 1 ? 's' : ''}</span>
                    )}
                    <ChevronRight size={16} style={{ opacity: 0.4 }} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* PAPERS LIST */}
      {screen === 'papers' && (
        <>
          {loading && <div style={styles.infoBox}>Loading papers…</div>}
          {!loading && papers.length === 0 && (
            <div style={styles.infoBox}>
              <AlertCircle size={16} />
              <span>No papers uploaded yet for this course. Be the first to contribute!</span>
            </div>
          )}
          <div style={styles.list}>
            {papers.map((p) => {
              const canManage = canManageDept(dept);
              const busy = deleteBusyKey === p.key;
              return (
                <div key={p.key} style={styles.listItem}>
                  <button style={styles.paperOpenArea} onClick={() => openPaper(p)}>
                    <div style={styles.paperRow}>
                      <FileText size={18} style={{ opacity: 0.6 }} />
                      <span style={styles.listItemCode}>{p.label}</span>
                    </div>
                  </button>

                  <div style={styles.listItemRight}>
                    {canManage && confirmDeleteKey !== p.key && requestDeleteKey !== p.key && (
                      <button
                        style={styles.deleteIconBtn}
                        title={isFounder ? 'Delete' : 'Request deletion'}
                        disabled={busy}
                        onClick={() => (isFounder ? setConfirmDeleteKey(p.key) : setRequestDeleteKey(p.key))}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    {!canManage && <ExternalLink size={16} style={{ opacity: 0.4 }} onClick={() => openPaper(p)} />}

                    {isFounder && confirmDeleteKey === p.key && (
                      <div style={styles.confirmRow}>
                        <span style={styles.confirmLabel}>Delete this paper?</span>
                        <button style={styles.confirmDangerBtn} disabled={busy} onClick={() => handleFounderDelete(p)}>
                          {busy ? 'Deleting…' : 'Delete'}
                        </button>
                        <button style={styles.confirmCancelBtn} disabled={busy} onClick={() => setConfirmDeleteKey(null)}>
                          Cancel
                        </button>
                      </div>
                    )}

                    {!isFounder && requestDeleteKey === p.key && (
                      <div style={styles.confirmRow}>
                        <span style={styles.confirmLabel}>Request deletion?</span>
                        <button style={styles.confirmDangerBtn} disabled={busy} onClick={() => handleRequestDelete(p)}>
                          {busy ? 'Sending…' : 'Request'}
                        </button>
                        <button style={styles.confirmCancelBtn} disabled={busy} onClick={() => setRequestDeleteKey(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showUpload && (
        <UploadQuestionModal
          defaultDept={dept}
          defaultTerm={term}
          defaultCourse={course?.code}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}

const styles = {
  page: {
    width: '100%',
    padding: '20px',
    minHeight: '100vh',
    color: 'var(--text)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '6px 10px',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: 13,
  },
  headerTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  uploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--accent)',
    color: 'var(--card)',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '8px 12px',
    marginBottom: 16,
  },
  jumpCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 16px',
    cursor: 'pointer',
    marginBottom: 14,
    textAlign: 'left',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 14,
    flex: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10,
  },
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '14px 16px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  cardCode: { fontWeight: 700, fontSize: 15, color: 'var(--text)' },
  cardSub: { fontSize: 12, opacity: 0.65, color: 'var(--text)' },
  cardArrow: { position: 'absolute', top: 12, right: 12, opacity: 0.35 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  listItemRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  listItemCode: { fontWeight: 700, fontSize: 14, color: 'var(--text)' },
  listItemTitle: { fontSize: 12, opacity: 0.65, color: 'var(--text)' },
  paperRow: { display: 'flex', alignItems: 'center', gap: 10 },
  paperOpenArea: {
    display: 'flex', alignItems: 'center', flex: 1, minWidth: 0,
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
  },
  deleteIconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: '1px solid var(--border)', borderRadius: 8,
    width: 30, height: 30, cursor: 'pointer', color: 'var(--danger)',
  },
  confirmRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  confirmLabel: { fontSize: 11.5, color: 'var(--muted)' },
  confirmDangerBtn: {
    background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  confirmCancelBtn: {
    background: 'none', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, cursor: 'pointer',
  },
  paperBadge: {
    fontSize: 11,
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 999,
    padding: '2px 8px',
    opacity: 0.85,
  },
  infoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 16,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
    color: '#f87171',
  },
  retryBtn: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'none',
    border: '1px solid currentColor',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
    color: 'inherit',
    fontSize: 12,
  },
};