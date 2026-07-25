import { Bell, Trash2 } from 'lucide-react';
import NoticeInsightsPanel from '../components/NoticeInsightsPanel';
import NoticeComposerToolbar from '../components/NoticeComposerToolbar';
import NoticePrioritySelector from '../components/NoticePrioritySelector';
import { renderFormattedNoticeBody } from '../lib/noticeFormat';
import { useClassRosterState } from './useClassRosterState';

/**
 * Independent "Notices" page — split out of the old ClassRoster.jsx
 * (Roster / Notices / My Role tab-switch). Same data source and
 * behavior as before, minus the tab switch.
 */
export default function ClassNotices() {
  const s = useClassRosterState();

  return (
    <div className="page-enter content-page-bg" style={{ width: 'min(95vw, 1560px)', margin: '0 auto', padding: '16px 14px', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <Bell size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Notices</h1>
          </div>
          {s.groupId && (
            <p className="content-page-hero-subtitle">
              Send and manage notices for <strong>{s.groupLabel}</strong>
            </p>
          )}
        </div>
      </div>

      {!s.groupId ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Add your department and batch in Profile to manage class notices.
        </p>
      ) : (s.myRole === 'cr' || s.myRole === 'acr') ? (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Send a notice to your class</h2>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
              Tip: leave a blank line between points to start a new paragraph — it'll show up nicely spaced for your classmates.
            </p>
            <form onSubmit={s.handleSendNotice} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                placeholder="Title"
                value={s.title}
                onChange={(e) => s.setTitle(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />

              <NoticePrioritySelector value={s.priority} onChange={s.setPriority} />

              {!s.showPreview ? (
                <>
                  <NoticeComposerToolbar
                    textareaRef={s.noticeTextareaRef}
                    value={s.body}
                    onChange={s.setBody}
                  />
                  <textarea
                    ref={s.noticeTextareaRef}
                    placeholder={'Notice details...\n\nLeave a blank line to start a new paragraph.'}
                    value={s.body}
                    onChange={(e) => s.setBody(e.target.value)}
                    className="input"
                    rows={6}
                    style={{ width: '100%', resize: 'vertical', lineHeight: 1.55 }}
                  />
                </>
              ) : (
                <div style={{
                  padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface)', fontSize: 13, color: 'var(--text)', lineHeight: 1.55,
                  minHeight: 96,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{s.title.trim() || <span style={{ color: 'var(--muted)' }}>(no title)</span>}</div>
                  {s.body.trim()
                    ? renderFormattedNoticeBody(s.body)
                    : <span style={{ color: 'var(--muted)' }}>(nothing written yet)</span>}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={s.sending || !s.title.trim() || !s.body.trim()}
                >
                  {s.sending ? 'Sending...' : 'Send notice'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => s.setShowPreview((v) => !v)}
                  disabled={!s.title.trim() && !s.body.trim()}
                >
                  {s.showPreview ? 'Back to edit' : 'Preview'}
                </button>
              </div>
              {s.sendMsg && (
                <div style={{ fontSize: 12, color: s.sendMsg.startsWith('Failed') ? 'var(--danger)' : 'var(--success)' }}>
                  {s.sendMsg}
                </div>
              )}
            </form>
          </div>

          {s.sentNotices.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Sent notices</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.sentNotices.map((n) => (
                  <div key={n.id} className="card" style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{n.title}</div>
                        {n.deleted && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase',
                            border: '1px solid var(--danger)', borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                          }}>
                            Deleted
                          </span>
                        )}
                      </div>
                      {!n.deleted && (
                        <button
                          type="button"
                          onClick={() => s.handleDeleteNotice(n.id)}
                          disabled={s.deletingId === n.id}
                          aria-label={`Delete notice: ${n.title}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                            fontSize: 11, fontWeight: 700, color: 'var(--danger)',
                            background: 'none', border: 'none', cursor: s.deletingId === n.id ? 'not-allowed' : 'pointer',
                            padding: 0, opacity: s.deletingId === n.id ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, opacity: n.deleted ? 0.6 : 1 }}>
                      {renderFormattedNoticeBody(n.body)}
                    </div>
                    <NoticeInsightsPanel
                      noticeId={n.id}
                      groupId={s.groupId}
                      audienceSize={n.audienceSize}
                      title={n.title}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Only CR/ACR can send notices to the class.
        </p>
      )}
    </div>
  );
}
