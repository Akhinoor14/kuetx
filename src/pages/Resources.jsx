import { useEffect, useState } from 'react';
import { FolderOpen, Paperclip, Link2 } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import {
  subscribeResources, addLinkResource, uploadFileResource, deleteResource,
} from '../lib/groupSync';
import { auth } from '../lib/firebase';

export default function Resources() {
  const profile = getProfile();
  const groupId = getGroupId(profile);
  const groupLabel = getGroupLabel(profile);
  const uid = auth.currentUser?.uid;

  const [resources, setResources] = useState(null);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState(null);
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!groupId) { setResources([]); return; }
    return subscribeResources(groupId, setResources);
  }, [groupId]);

  const parsedTags = () => tags.split(',').map((t) => t.trim()).filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupId || !title.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (file) {
        await uploadFileResource(groupId, profile, { title: title.trim(), file, tags: parsedTags() });
      } else if (linkUrl.trim()) {
        await addLinkResource(groupId, profile, { title: title.trim(), linkUrl: linkUrl.trim(), tags: parsedTags() });
      } else {
        setError('Add a link or choose a file.');
        setBusy(false);
        return;
      }
      setTitle(''); setLinkUrl(''); setFile(null); setTags('');
    } catch (err) {
      setError(err?.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter content-page-bg" style={{ maxWidth: 640, margin: '0 auto', padding: '16px 14px' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <FolderOpen size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Class Resources</h1>
          </div>
          <p className="content-page-hero-subtitle">
            {groupId ? <>Notes, question banks, and links shared by <strong>{groupLabel}</strong>.</> : 'Set your department and batch in Profile to use shared resources.'}
          </p>
        </div>
      </div>

      {groupId && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text" placeholder="Title (e.g. Mid-term 2024 question, Chapter 3 notes)"
            value={title} onChange={(e) => setTitle(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}
          />
          <input
            type="url" placeholder="Link URL (Drive/Docs/etc — leave blank if attaching a file)"
            value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} disabled={!!file}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}
          />
          <input
            type="file" onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ fontSize: 13 }}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Max 5MB per file.</div>
          <input
            type="text" placeholder="Tags, comma separated (e.g. midterm, chapter-3)"
            value={tags} onChange={(e) => setTags(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inputBg)' }}
          />
          {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Uploading…' : 'Share with class'}
          </button>
        </form>
      )}

      {resources === null && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
      {resources?.length === 0 && (
        <div className="card" style={{ padding: 16, color: 'var(--muted)', textAlign: 'center' }}>
          No resources shared yet — add the first one!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {resources?.map((r) => (
          <div key={r.id} className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <a href={r.linkUrl || r.fileUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 14 }}>
                  {r.title}
                </a>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {r.type === 'file' ? <Paperclip size={12} /> : <Link2 size={12} />} {r.type === 'file' ? 'File' : 'Link'} · shared by {r.uploadedBy?.name} ({r.uploadedBy?.roll})
                </div>
                {r.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {r.tags.map((t) => (
                      <span key={t} style={{ fontSize: 11, background: 'var(--inputBg)', padding: '2px 8px', borderRadius: 999, color: 'var(--muted)' }}>#{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {r.uploadedBy?.uid === uid && (
                <button className="btn btn-sm btn-secondary" onClick={() => deleteResource(groupId, r.id)}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
