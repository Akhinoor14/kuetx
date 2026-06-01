/**
 * CT & Quiz Planning Page
 * Smart academic planning system for class representatives
 */

import { useEffect, useState, useMemo } from 'react';
import { Download, Upload, Plus, Calendar, AlertCircle, CheckCircle, Info, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { store, getProfile, getCurrentTermKey, getTermLabelFromKey, uid } from '../store/store';
import { notify } from '../lib/notify';
import {
  getCTQuizPlans,
  saveCTQuizPlans,
  getCurrentTermCourses,
  getTermTimelineInfo,
  getTermHolidays,
  getDepartmentInfo,
  calculateInstructionDays,
  exportPlansAsJSON,
  importPlansFromJSON,
} from '../lib/ctQuizStore';
import {
  scheduleCourseCTs,
  generateMultipleModels,
  getSmartRecommendations,
  validateSchedule,
  calculatePressureScore,
  SCHEDULING_MODELS,
} from '../lib/ctQuizScheduler';

const pressureColor = (pressure) => {
  if (pressure < 30) return '#10b981'; // green
  if (pressure < 50) return '#f59e0b'; // amber
  if (pressure < 70) return '#ef4444'; // red
  return '#7f1d1d'; // dark red
};

const pressureLabel = (pressure) => {
  if (pressure < 30) return 'Low';
  if (pressure < 50) return 'Moderate';
  if (pressure < 70) return 'High';
  return 'Very High';
};

export default function CTQuizPlanning() {
  // State - profile must be reactive to detect updates from ProfileSetupModal
  const [profile, setProfile] = useState(getProfile());
  const [prevDept, setPrevDept] = useState(profile.dept);
  const [prevTermStartDate, setPrevTermStartDate] = useState(profile.termStartDate);
  const termKey = getCurrentTermKey(profile);
  const termLabel = getTermLabelFromKey(termKey);

  // State
  const [courses, setCourses] = useState([]);
  const [selectedModel, setSelectedModel] = useState('balanced');
  const [loading, setLoading] = useState(true);
  const [showSmartAssist, setShowSmartAssist] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [customizing, setCustomizing] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Data
  const termInfo = useMemo(() => getTermTimelineInfo(profile), [profile]);
  const holidays = useMemo(() => {
    if (!termInfo?.termCode) {
      console.warn('[CTQuizPlanning] No termCode available for holiday lookup');
      return [];
    }
    return getTermHolidays(termInfo.termCode);
  }, [termInfo?.termCode]);
  const deptInfo = useMemo(() => getDepartmentInfo(profile?.dept), [profile?.dept]);

  // Listen to store updates and refresh profile
  useEffect(() => {
    const handleStoreUpdate = () => {
      const newProfile = getProfile();
      setProfile(newProfile);
    };
    window.addEventListener('kuetx:store-updated', handleStoreUpdate);
    return () => window.removeEventListener('kuetx:store-updated', handleStoreUpdate);
  }, []);

  // Detect department or term start date changes and trigger reload
  useEffect(() => {
    const deptChanged = profile.dept && profile.dept !== prevDept;
    const termStartDateChanged = profile.termStartDate && profile.termStartDate !== prevTermStartDate;
    
    if (deptChanged || termStartDateChanged) {
      if (deptChanged) {
        console.log('[CTQuizPlanning] Department changed from', prevDept, 'to', profile.dept, '- reloading courses');
      }
      if (termStartDateChanged) {
        console.log('[CTQuizPlanning] Term start date changed from', prevTermStartDate, 'to', profile.termStartDate, '- refreshing holidays');
      }
      setPrevDept(profile.dept);
      setPrevTermStartDate(profile.termStartDate);
      loadData();
    }
  }, [profile.dept, profile.termStartDate, prevDept, prevTermStartDate]);

  // Load data when termKey changes
  useEffect(() => {
    loadData();
  }, [termKey]);

  function loadData() {
    setLoading(true);
    try {
      // Validate that termInfo is available
      if (!termInfo || !termInfo.termCode) {
        console.warn('[CTQuizPlanning] Cannot load data: missing termInfo or termCode');
        notify('Please set up your term start date in your profile', 'warning');
        setLoading(false);
        return;
      }

      // Get existing plans or create new
      let existingPlans = getCTQuizPlans(profile);
      
      if (!existingPlans) {
        // Try to load pre-generated recommendations first
        fetch('/recommended-ct-schedules.json', { cache: 'no-store' })
          .then(res => res.ok ? res.json() : null)
          .then(recommended => {
            const deptRec = recommended?.[profile?.dept];
            const termRec = deptRec?.terms?.[termKey];
            
            if (termRec?.models?.[selectedModel]) {
              // Use recommended schedule
              const modelData = termRec.models[selectedModel];
              const currentCourses = getCurrentTermCourses(profile);
              
              const scheduled = currentCourses.slice(0, modelData.ctDates?.length || 3).map((course, idx) => ({
                success: true,
                courseId: course.courseId,
                courseName: course.title || course.code,
                courseType: course.courseType === 'Sessional' ? 'sessional' : 'theory',
                credits: course.credits,
                numCTs: course.courseType === 'Sessional' ? 1 : 3,
                ctDates: [modelData.ctDates[idx]] || [],
                ctTeacherMap: {},
                teachers: course.teachers || ['Teacher 1', 'Teacher 2'],
                model: selectedModel,
                pressure: modelData.pressure || 50,
                warnings: [],
              }));
              
              setCourses(scheduled);
              saveCTQuizPlans({
                termCode: termInfo.termCode,
                dept: profile.dept,
                model: selectedModel,
                courses: scheduled,
              }, profile);
            } else {
              throw new Error('No recommended data');
            }
          })
          .catch(() => {
            // Fallback: generate on the fly
            const currentCourses = getCurrentTermCourses(profile);
            const scheduled = currentCourses.map(course => {
              const result = scheduleCourseCTs({
                courseId: course.courseId,
                courseName: course.title || course.code,
                courseType: course.courseType === 'Sessional' ? 'sessional' : 'theory',
                credits: course.credits,
                termStartDate: termInfo.termStartDate,
                termEndDate: termInfo.termEndDate,
                holidays,
                numCTs: course.courseType === 'Sessional' ? 1 : 3,
                teachers: course.teachers || ['Teacher 1', 'Teacher 2'],
                model: selectedModel,
              });
              return result.success ? result : null;
            }).filter(Boolean);

            setCourses(scheduled);
            saveCTQuizPlans({
              termCode: termInfo.termCode,
              dept: profile.dept,
              model: selectedModel,
              courses: scheduled,
            }, profile);
          });
      } else {
        setCourses(existingPlans.courses || []);
      }
    } catch (e) {
      console.error('Error loading data:', e);
      notify('Error loading planning data', 'error');
    }
    setLoading(false);
  }

  function regenerateSchedules(newModel) {
    if (!termInfo || !termInfo.termCode) {
      notify('Cannot regenerate: term information missing', 'error');
      return;
    }

    setLoading(true);
    try {
      const rescheduled = courses.map(course => {
        const result = scheduleCourseCTs({
          courseId: course.courseId,
          courseName: course.courseName,
          courseType: course.courseType,
          credits: course.credits,
          termStartDate: termInfo.termStartDate,
          termEndDate: termInfo.termEndDate,
          holidays,
          numCTs: course.numCTs,
          teachers: course.teachers,
          model: newModel,
        });
        return result.success ? result : course;
      });

      setCourses(rescheduled);
      setSelectedModel(newModel);

      // Save with termCode
      saveCTQuizPlans({
        termCode: termInfo.termCode,
        dept: profile.dept,
        model: newModel,
        courses: rescheduled,
      }, profile);

      notify('Schedule regenerated', 'success');
    } catch (e) {
      console.error('Error regenerating schedule:', e);
      notify('Error regenerating schedule', 'error');
    }
    setLoading(false);
  }

  function handleExport() {
    try {
      const data = exportPlansAsJSON(profile);
      if (!data) throw new Error('No plans to export');

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ct-quiz-plan-${profile.dept}-${termKey}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify('Plans exported successfully', 'success');
    } catch (e) {
      notify('Error exporting plans', 'error');
    }
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        if (importPlansFromJSON(data, profile)) {
          loadData();
          notify('Plans imported successfully', 'success');
        } else {
          throw new Error('Invalid import format');
        }
      };
      reader.readAsText(file);
    } catch (e) {
      notify('Error importing plans', 'error');
    }
  }

  const recommendations = useMemo(
    () => getSmartRecommendations(courses, termInfo),
    [courses, termInfo]
  );

  const validationIssues = useMemo(
    () => validateSchedule(courses, termInfo),
    [courses, termInfo]
  );

  const avgPressure = useMemo(
    () => courses.length > 0
      ? courses.reduce((sum, c) => sum + (c.pressure || 0), 0) / courses.length
      : 0,
    [courses]
  );

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 16, animation: 'spin 1s linear infinite' }}>⏳</div>
          <div style={{ color: 'var(--muted)' }}>Loading planning system...</div>
        </div>
      </div>
    );
  }

  // Check if term info is available
  if (!termInfo) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={48} style={{ marginBottom: 16, color: '#ef4444' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Term Information Missing</h2>
          <div style={{ color: 'var(--muted)', marginBottom: 16 }}>
            Please set up your term start date in your profile to use the planning system.
          </div>
          <a
            href="/profile"
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Go to Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter page-container">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900 }}>CT & Quiz Planning</h1>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>
              {deptInfo.name} • {termLabel}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleExport}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              title="Export as JSON"
            >
              <Download size={14} /> Export
            </button>
            <label
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              title="Import from JSON"
            >
              <Upload size={14} /> Import
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {/* Overall Status */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}>
          <div style={{
            padding: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 13,
          }}>
            <div style={{ color: 'var(--muted)', marginBottom: 4 }}>Courses Scheduled</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{courses.length}</div>
          </div>
          <div style={{
            padding: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 13,
          }}>
            <div style={{ color: 'var(--muted)', marginBottom: 4 }}>Average Pressure</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: pressureColor(avgPressure) }}>
              {pressureLabel(avgPressure)} ({Math.round(avgPressure)}%)
            </div>
          </div>
          <div style={{
            padding: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 13,
          }}>
            <div style={{ color: 'var(--muted)', marginBottom: 4 }}>Current Model</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {SCHEDULING_MODELS[selectedModel]?.label}
            </div>
          </div>
        </div>
      </div>

      {/* Smart Recommendations */}
      {showSmartAssist && recommendations.length > 0 && (
        <div style={{
          marginBottom: 24,
          padding: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} style={{ color: 'var(--accent)' }} />
              Smart Recommendations
            </h3>
            <button
              onClick={() => setShowSmartAssist(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
            >
              ×
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recommendations.map((rec, idx) => (
              <div key={idx} style={{
                padding: 10,
                background: rec.severity === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                borderLeft: `3px solid ${rec.severity === 'high' ? '#ef4444' : '#3b82f6'}`,
                borderRadius: 6,
                fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{rec.message}</div>
                {rec.action && <div style={{ color: 'var(--muted)' }}>💡 {rec.action}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Issues */}
      {validationIssues.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {validationIssues.map((issue, idx) => (
            <div key={idx} style={{
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              fontSize: 12,
              marginBottom: 8,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}>
              <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0, color: '#ef4444' }} />
              <div>{issue.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* Model Selector */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Select Scheduling Model</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
        }}>
          {Object.values(SCHEDULING_MODELS).map(model => (
            <button
              key={model.id}
              onClick={() => regenerateSchedules(model.id)}
              style={{
                padding: 12,
                background: selectedModel === model.id ? 'var(--accent)' : 'var(--surface)',
                color: selectedModel === model.id ? 'white' : 'var(--text)',
                border: selectedModel === model.id ? 'none' : '1px solid var(--border)',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (selectedModel !== model.id) {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedModel !== model.id) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{model.label}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{model.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Courses List */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Scheduled Courses</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courses.length === 0 ? (
            <div style={{
              padding: 20,
              textAlign: 'center',
              color: 'var(--muted)',
              border: '1px dashed var(--border)',
              borderRadius: 10,
            }}>
              No courses scheduled yet
            </div>
          ) : (
            courses.map(course => (
              <div
                key={course.courseId}
                style={{
                  padding: 14,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
                onClick={() => setExpandedCourse(expandedCourse === course.courseId ? null : course.courseId)}
              >
                {/* Course Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{course.courseName}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {course.courseId} • {course.courseType === 'theory' ? 'Theory' : 'Lab/Sessional'}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <div style={{
                      padding: '4px 10px',
                      background: pressureColor(course.pressure),
                      color: 'white',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {pressureLabel(course.pressure)}
                    </div>
                    {expandedCourse === course.courseId ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedCourse === course.courseId && (
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>
                        CT Dates ({course.numCTs} total)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                        {course.ctDates.map((date, idx) => (
                          <div key={idx} style={{
                            padding: 8,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            fontSize: 12,
                            textAlign: 'center',
                          }}>
                            <div>{new Date(date).toLocaleDateString()}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                              {course.ctTeacherMap[date]}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {course.warnings && course.warnings.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#ef4444' }}>
                          ⚠️ Warnings
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                          {course.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        fontSize: 12,
        color: 'var(--muted)',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: 8 }}>✓ All plans are automatically saved to your device</div>
        <div>Changes sync with Schedule and Class Management systems</div>
      </div>
    </div>
  );
}
