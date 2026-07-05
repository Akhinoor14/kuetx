import { useState } from 'react';
import { X, UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { QB_DEPARTMENTS } from '../data/questionbank/questionBankData';
import { QB_COURSE_CODES } from '../data/questionbank/qbCourseCodes';

const TERMS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];
const EXAM_TYPES = [
  { value: 'Regular', label: 'Regular (Term Final)' },
  { value: 'Backlog', label: 'Backlog' },
  { value: 'Special', label: 'Special' },
  { value: 'MidTerm', label: 'Mid Term' },
  { value: 'FinalTerm', label: 'Final Term' },
  { value: 'CT', label: 'Class Test (CT)' },
  { value: 'LabQuiz', label: 'Lab Quiz' },
];

const SCRIPT_URL = import.meta.env.VITE_UPLOAD_SCRIPT_URL;

export default function UploadQuestionModal({ defaultDept, defaultTerm, defaultCourse, onClose }) {
  const [form, setForm] = useState({
    name: '',
    roll: '',
    email: '',
    dept: defaultDept || '',
    term: defaultTerm || '',
    courseCode: defaultCourse || '',
    examType: '',
    examTypeNumber: '', // for CT-2, LabQuiz-3 etc.
    examYear: '',
  });
  const [questionFiles, setQuestionFiles] = useState([]);
  const [solutionFiles, setSolutionFiles] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const hasCurriculumData = form.dept ? Boolean(QB_COURSE_CODES[form.dept]) : false;
  const courseOptions = hasCurriculumData && form.term
    ? (QB_COURSE_CODES[form.dept]?.[form.term] || [])
    : [];

  const needsNumber = form.examType === 'CT' || form.examType === 'LabQuiz';

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    if (!form.name || !form.roll || !form.email) return 'Please fill in your name, roll, and email.';
    if (!form.dept || !form.term) return 'Please select department and term.';
    if (!form.courseCode.trim()) return 'Please select or type the course code.';
    if (!form.examType) return 'Please select the exam type.';
    if (needsNumber && !form.examTypeNumber) return 'Please enter the CT/Lab Quiz number.';
    if (!form.examYear.trim()) return 'Please enter the exam year.';
    if (questionFiles.length === 0 && solutionFiles.length === 0) {
      return 'Please attach at least one question or solution file.';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setStatus('error');
      setErrorMsg(validationError);
      return;
    }
    if (!SCRIPT_URL) {
      setStatus('error');
      setErrorMsg('Upload endpoint is not configured.');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');

    const finalExamType = needsNumber ? `${form.examType}${form.examTypeNumber}` : form.examType;

    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('roll', form.roll);
    fd.append('email', form.email);
    fd.append('dept', form.dept);
    fd.append('term', form.term);
    fd.append('courseCode', form.courseCode);
    fd.append('examType', finalExamType);
    fd.append('examYear', form.examYear);
    questionFiles.forEach((f) => fd.append('questionFiles', f));
    solutionFiles.forEach((f) => fd.append('solutionFiles', f));

    try {
      const res = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Upload Question / Solution</h2>
          <button style={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        {status === 'success' ? (
          <div style={styles.successBox}>
            <CheckCircle size={40} color="var(--accent)" />
            <p style={{ fontWeight: 600, margin: '12px 0 4px' }}>Thank you for contributing!</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              Your files have been received and will be reviewed before appearing on the site.
            </p>
            <button style={styles.submitBtn} onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.row}>
              <Field label="Your Name">
                <input style={styles.input} value={form.name} onChange={(e) => update('name', e.target.value)} />
              </Field>
              <Field label="Roll">
                <input style={styles.input} value={form.roll} onChange={(e) => update('roll', e.target.value)} placeholder="2113014" />
              </Field>
            </div>

            <Field label="Email">
              <input style={styles.input} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </Field>

            <div style={styles.row}>
              <Field label="Department">
                <select
                  style={styles.input}
                  value={form.dept}
                  onChange={(e) => update('dept', e.target.value)}
                >
                  <option value="">Select...</option>
                  {Object.entries(QB_DEPARTMENTS).map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name.replace('Department of ', '')}</option>
                  ))}
                </select>
              </Field>
              <Field label="Term">
                <select style={styles.input} value={form.term} onChange={(e) => update('term', e.target.value)}>
                  <option value="">Select...</option>
                  {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Course Code">
              {hasCurriculumData && form.term && courseOptions.length > 0 ? (
                <select style={styles.input} value={form.courseCode} onChange={(e) => update('courseCode', e.target.value)}>
                  <option value="">Select course...</option>
                  {courseOptions.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.title}</option>
                  ))}
                </select>
              ) : (
                <input
                  style={styles.input}
                  value={form.courseCode}
                  onChange={(e) => update('courseCode', e.target.value)}
                  placeholder="e.g. ME 2113"
                />
              )}
            </Field>

            <div style={styles.row}>
              <Field label="Exam Type">
                <select style={styles.input} value={form.examType} onChange={(e) => update('examType', e.target.value)}>
                  <option value="">Select...</option>
                  {EXAM_TYPES.map((et) => <option key={et.value} value={et.value}>{et.label}</option>)}
                </select>
              </Field>
              {needsNumber && (
                <Field label={`${form.examType} No.`}>
                  <input
                    style={styles.input}
                    type="number"
                    min="1"
                    value={form.examTypeNumber}
                    onChange={(e) => update('examTypeNumber', e.target.value)}
                    placeholder="1"
                  />
                </Field>
              )}
              <Field label="Exam Year">
                <input
                  style={styles.input}
                  value={form.examYear}
                  onChange={(e) => update('examYear', e.target.value)}
                  placeholder="2024"
                />
              </Field>
            </div>

            <Field label="Question File(s)">
              <input
                style={styles.fileInput}
                type="file"
                accept="application/pdf,image/*"
                multiple
                onChange={(e) => setQuestionFiles(Array.from(e.target.files))}
              />
            </Field>

            <Field label="Solution File(s) — optional">
              <input
                style={styles.fileInput}
                type="file"
                accept="application/pdf,image/*"
                multiple
                onChange={(e) => setSolutionFiles(Array.from(e.target.files))}
              />
            </Field>

            {status === 'error' && (
              <div style={styles.errorBox}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button type="submit" style={styles.submitBtn} disabled={status === 'submitting'}>
              {status === 'submitting' ? (
                <><Loader2 size={16} className="spin" /> Uploading…</>
              ) : (
                <><UploadCloud size={16} /> Submit</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: 'var(--surface)', color: 'var(--text)',
    borderRadius: 16, width: '100%', maxWidth: 480,
    maxHeight: '90vh', overflowY: 'auto', padding: 20,
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: 700, margin: 0 },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', opacity: 0.6,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: 600, opacity: 0.75 },
  input: {
    border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px',
    fontSize: 14, background: 'var(--bg)', color: 'var(--text)', outline: 'none',
  },
  fileInput: { fontSize: 13 },
  submitBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'var(--accent)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', marginTop: 6,
  },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#f87171',
  },
  successBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', padding: '24px 12px',
  },
};
