// AvatarUploadModal.jsx
//
// Shared local-first + drag-to-reposition profile picture upload modal,
// extracted from the student Profile.jsx so Faculty Profile can reuse the
// exact same upload experience (student-style photo upload) instead of a
// plain static avatar with no upload option.

import { useState, useRef } from 'react';
import * as Icons from 'lucide-react';
import { uploadProfilePicture, deleteProfilePicture } from '../lib/profilePicture';
import { confirmDialog } from '../lib/dialog';

export function AvatarUploadModal({ currentURL, isAnon, onClose, onUploaded, onDeleted }) {
  const [preview, setPreview] = useState(null);   // raw objectURL for drag canvas
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef();

  // Drag-to-reposition state
  const [offset, setOffset] = useState({ x: 0, y: 0 });        // pixel offset in original image coords
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);   // { mouseX, mouseY, offsetX, offsetY }
  const imgNatural = useRef({ w: 1, h: 1 });  // natural image dimensions
  const PREVIEW_PX = 200;  // preview circle diameter px

  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Only image files allowed'); return; }
    if (f.size > 10 * 1024 * 1024) { setError('Max 10 MB'); return; }
    setError('');
    setFile(f);
    setOffset({ x: 0, y: 0 });
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { imgNatural.current = { w: img.naturalWidth, h: img.naturalHeight }; };
    img.src = url;
    setPreview(url);
  };

  const handleDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); };

  // Mouse drag handlers on the preview circle
  const onMouseDown = (e) => {
    if (!preview || !file) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, offsetX: offset.x, offsetY: offset.y };
  };
  const onMouseMove = (e) => {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.mouseX;
    const dy = e.clientY - dragStart.current.mouseY;
    // Scale mouse pixels → image pixels
    const { w, h } = imgNatural.current;
    const size = Math.min(w, h);
    const scale = size / PREVIEW_PX;
    setOffset({ x: dragStart.current.offsetX - dx * scale, y: dragStart.current.offsetY - dy * scale });
  };
  const onMouseUp = () => { setDragging(false); dragStart.current = null; };

  // Touch support
  const onTouchStart = (e) => {
    if (!preview || !file) return;
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { mouseX: t.clientX, mouseY: t.clientY, offsetX: offset.x, offsetY: offset.y };
  };
  const onTouchMove = (e) => {
    if (!dragging || !dragStart.current) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - dragStart.current.mouseX;
    const dy = t.clientY - dragStart.current.mouseY;
    const { w, h } = imgNatural.current;
    const size = Math.min(w, h);
    const scale = size / PREVIEW_PX;
    setOffset({ x: dragStart.current.offsetX - dx * scale, y: dragStart.current.offsetY - dy * scale });
  };
  const onTouchEnd = () => { setDragging(false); dragStart.current = null; };

  // Compute background-position for the CSS preview (% based)
  const bgPosition = () => {
    if (!preview) return 'center center';
    const { w, h } = imgNatural.current;
    const size = Math.min(w, h);
    // center offset in original image pixels, clamped
    const maxOff = (Math.max(w, h) - size) / 2;
    const cx = Math.max(-maxOff, Math.min(maxOff, offset.x));
    const cy = Math.max(-maxOff, Math.min(maxOff, offset.y));
    // convert to % for background-position
    const px = w > size ? 50 + (cx / (w - size)) * 100 : 50;
    const py = h > size ? 50 + (cy / (h - size)) * 100 : 50;
    return `${px.toFixed(1)}% ${py.toFixed(1)}%`;
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const url = await uploadProfilePicture(file, setProgress, offset.x, offset.y);
      onUploaded(url);
      onClose();
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirmDialog('Delete the profile picture?'))) return;
    try { await deleteProfilePicture(); onDeleted(); onClose(); } catch {}
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Profile Picture</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><Icons.X size={18} /></button>
        </div>

        {/* Info banner */}
        <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <Icons.HardDrive size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Photos stay on this device for offline use.{!isAnon ? ' A Firebase backup is also saved.' : ' Sign in to sync across devices.'}</span>
        </div>

        {/* Drop zone (only when no file) */}
        {!file && (
          <div
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '28px 20px', border: '2px dashed var(--border)', borderRadius: 16, cursor: 'pointer', background: 'var(--inputBg)', transition: 'border-color 0.15s, background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accentSoft)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--inputBg)'; }}
          >
            {currentURL
              ? <img src={currentURL} alt="Current" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }} />
              : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Camera size={32} color="white" /></div>
            }
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Click or drag & drop</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>JPG, PNG, WebP · Max 10 MB</div>
            </div>
          </div>
        )}

        {/* Drag-to-reposition preview (shown when file selected) */}
        {file && preview && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            {/* Circle preview — draggable */}
            <div
              onMouseDown={onMouseDown}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
              style={{
                width: PREVIEW_PX, height: PREVIEW_PX, borderRadius: '50%',
                border: '3px solid var(--accent)',
                boxShadow: '0 4px 20px rgba(22,163,74,0.25)',
                cursor: dragging ? 'grabbing' : 'grab',
                overflow: 'hidden',
                backgroundImage: `url(${preview})`,
                backgroundSize: 'cover',
                backgroundPosition: bgPosition(),
                backgroundRepeat: 'no-repeat',
                userSelect: 'none', WebkitUserSelect: 'none',
                flexShrink: 0,
                touchAction: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
              <Icons.Move size={13} />
              Drag to reposition
            </div>
            {/* Change photo button */}
            <button onClick={() => { setFile(null); setPreview(null); setOffset({ x: 0, y: 0 }); inputRef.current?.click(); }}
              style={{ fontSize: 12, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
              Choose different photo
            </button>
          </div>
        )}

        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

        {/* Progress */}
        {uploading && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>
              <span>Saving…</span><span>{progress}%</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: 99, height: 5 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 99, transition: 'width 0.25s' }} />
            </div>
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>{error}</div>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {currentURL && (
            <button onClick={handleDelete} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Remove
            </button>
          )}
          <button onClick={handleUpload} disabled={!file || uploading}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none', background: file && !uploading ? 'var(--accent)' : 'var(--border)', color: file && !uploading ? '#fff' : 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: file && !uploading ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            {uploading ? 'Saving…' : 'Save Photo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AvatarUploadModal;
