// ErrandFeed.jsx
//
// OPEN ERRAND REQUEST FEED — new shop-less Pick and Drop, replacing the
// old Runner/shop-based errand mode. See documentation/03-features/
// errand-open-feed/CURRENT.md for the full design history, and
// src/lib/errandRequests.js's own module doc-comment for the data model
// reasoning (that file is the single source of truth for WHY things are
// shaped this way — this file just wires UI to it).
//
// This one file covers three closely-coupled pieces (post form, feed,
// detail modal) since they all live on /services/errands and share the
// same live subscription + "which request is open in the modal" state —
// splitting them into separate files/routes would just mean passing that
// state across a boundary for no benefit. "My Requests" / "My Accepted"
// (a genuinely separate page, /services/errands/mine) and the Founder
// admin view are NOT here — those come in later steps.
//
// Naming: this file imports ONLY from errandRequests.js (the new open
// feed data layer). serviceSync.js's similarly-named OLD functions
// (createErrandRequest, acceptErrandRequest, cancelErrandRequest,
// finishErrandRequest — shop-based) are never imported here at all, so
// there's no aliasing needed in this file specifically. Any future file
// that needs both must alias per errandRequests.js's own warning.
//
// Exports beyond the default: useRequesterIdentity, RequestDetailModal,
// and ErrandDeadline are exported so ErrandMyRequests.jsx (the separate
// "My Requests"/"My Accepted" page, /services/errands/mine) can reuse
// them directly instead of duplicating the identity-resolution logic or
// the three-view detail modal a second time.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bike, Camera, Clock, ListChecks, X, BellOff, Bell } from 'lucide-react';
import { auth } from '../lib/firebase';
import { getProfile } from '../store/store';
import { useIsFaculty } from '../hooks/useIsFaculty';
import { subscribeFacultyProfile } from '../lib/facultySync';
import { uploadServiceImage } from '../lib/serviceImageUpload';
import {
  createOpenErrandRequest, subscribeOpenErrandRequests, subscribeErrandRequest,
  subscribeErrandAccepts, acceptErrandRequest, confirmErrandAcceptor,
  finishErrandRequest, cancelErrandRequest, getSavedErrandPhone,
  generateErrandRequestId, patchErrandRequestImage, isErrandRunner,
  subscribeErrandBroadcastOptOut, setErrandBroadcastOptOut,
} from '../lib/errandRequests';
import Modal from '../components/Modal';

// ---------------------------------------------------------------------
// Requester identity — student name comes from the local profile store
// (getProfile().name, same source Extras.jsx/QuestionBankSolutions.jsx
// etc. already use); faculty name comes from their own faculty/{uid}
// doc via subscribeFacultyProfile (facultySync.js), since faculty never
// have a student `profile` doc. useIsFaculty() (server-verified, same
// hook Services.jsx already uses for the broadcast-strip gate) decides
// which source applies — never self-reported.
//
// isRunner (this session's addition — see module doc comment's
// visibility model): resolved via errandRequests.js's isErrandRunner(),
// a one-shot check for a verified Provider account with at least one
// 'errand'-type shop. Only meaningful for non-faculty viewers (a faculty
// account can never be a Runner in this app's role model), so the check
// is skipped entirely for faculty viewers to avoid a wasted query.
// ---------------------------------------------------------------------
export function useRequesterIdentity() {
  const uid = auth.currentUser?.uid || null;
  const { isFaculty, isFounderBypass } = useIsFaculty();
  const isFacultyViewer = isFaculty || isFounderBypass;
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [isRunner, setIsRunner] = useState(false);

  useEffect(() => {
    if (!uid || !isFacultyViewer) { setFacultyProfile(null); return; }
    return subscribeFacultyProfile(uid, setFacultyProfile);
  }, [uid, isFacultyViewer]);

  useEffect(() => {
    if (!uid || isFacultyViewer) { setIsRunner(false); return; }
    let cancelled = false;
    isErrandRunner(uid).then((result) => { if (!cancelled) setIsRunner(result); });
    return () => { cancelled = true; };
  }, [uid, isFacultyViewer]);

  return useMemo(() => {
    if (isFacultyViewer) {
      return { uid, name: facultyProfile?.name || '', role: 'faculty', isFaculty: true, isRunner: false };
    }
    const profile = getProfile();
    return { uid, name: profile?.name || '', role: 'student', isFaculty: false, isRunner };
  }, [uid, isFacultyViewer, facultyProfile, isRunner]);
}

export default function ErrandFeed() {
  const navigate = useNavigate();
  const identity = useRequesterIdentity();
  const [requests, setRequests] = useState(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [openRequestId, setOpenRequestId] = useState(null);
  const [optedOut, setOptedOut] = useState(false);

  // Faculty never see the browsable feed at all (see errandRequests.js's
  // module doc comment) — a student who has opted out also sees an
  // empty feed until they turn it back on. Runners (verified Provider
  // accounts with an errand-type shop) and plain students both see it
  // normally, gated only by their own opt-out state.
  const canSeeFeed = !identity.isFaculty && !optedOut;

  useEffect(() => {
    if (!identity.uid || identity.isFaculty) { setOptedOut(false); return undefined; }
    return subscribeErrandBroadcastOptOut(identity.uid, setOptedOut);
  }, [identity.uid, identity.isFaculty]);

  useEffect(
    () => subscribeOpenErrandRequests(identity.uid, setRequests, canSeeFeed),
    [identity.uid, canSeeFeed],
  );

  return (
    <div className="page-enter page-container content-page-bg">
      <FeedHeader
        navigate={navigate}
        openCount={requests?.length ?? 0}
        onPost={() => setShowPostForm(true)}
        showBroadcastToggle={!identity.isFaculty}
        optedOut={optedOut}
        onToggleOptOut={async () => {
          const next = !optedOut;
          setOptedOut(next); // optimistic — feed hook above reacts immediately
          try {
            await setErrandBroadcastOptOut(identity.uid, next);
          } catch {
            setOptedOut(!next); // revert on failure
          }
        }}
      />

      {identity.isFaculty ? (
        <div className="card kx-errand-empty">
          <Bike size={36} strokeWidth={1.5} />
          <div style={{ fontWeight: 700, marginTop: 10 }}>আপনার পোস্ট করা রিকোয়েস্ট এখানে দেখা যাবে না</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4, maxWidth: 340 }}>
            Faculty অ্যাকাউন্ট থেকে রিকোয়েস্ট পোস্ট করা যায়, কিন্তু অন্যদের খোলা রিকোয়েস্টের তালিকা এখানে দেখা যায় না।
            নিজের পোস্ট করা রিকোয়েস্টের অবস্থা "আমার রিকোয়েস্ট"-এ দেখুন।
          </div>
        </div>
      ) : optedOut ? (
        <div className="card kx-errand-empty">
          <BellOff size={36} strokeWidth={1.5} />
          <div style={{ fontWeight: 700, marginTop: 10 }}>রিকোয়েস্ট ব্রডকাস্ট বন্ধ আছে</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>
            আপনার কাছে নতুন কোনো রিকোয়েস্ট আসবে না। উপরের বেল আইকনে চাপ দিয়ে আবার চালু করতে পারেন।
          </div>
        </div>
      ) : requests === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card kx-errand-skeleton" style={{ padding: 16, height: 88 }} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="card kx-errand-empty">
          <Bike size={36} strokeWidth={1.5} />
          <div style={{ fontWeight: 700, marginTop: 10 }}>এখন কোনো খোলা রিকোয়েস্ট নেই</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>
            কারো কিছু আনা-নেওয়া লাগলে, নিচের বাটন থেকে একটা রিকোয়েস্ট পোস্ট করুন।
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map((r) => (
            <ErrandCard key={r.id} req={r} onOpen={() => setOpenRequestId(r.id)} />
          ))}
        </div>
      )}

      {showPostForm && (
        <Modal
          onClose={() => setShowPostForm(false)}
          contentStyle={{ width: 'min(460px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}
        >
          <PostRequestForm
            identity={identity}
            onClose={() => setShowPostForm(false)}
            onPosted={(id) => { setShowPostForm(false); setOpenRequestId(id); }}
          />
        </Modal>
      )}

      {openRequestId && (
        <Modal
          onClose={() => setOpenRequestId(null)}
          contentStyle={{ width: 'min(460px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}
        >
          <RequestDetailModal
            requestId={openRequestId}
            identity={identity}
            onClose={() => setOpenRequestId(null)}
          />
        </Modal>
      )}

      <style>{`
        .kx-errand-skeleton { animation: kxErrandPulse 1.1s ease-in-out infinite; }
        @keyframes kxErrandPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        .kx-errand-empty {
          padding: 40px 20px; text-align: center; color: var(--muted);
          display: flex; flex-direction: column; align-items: center;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
// Header — back button, live open-count, "post a request" CTA. The
// count is the SAME array length driving the card list below (no
// separate query), so it's always in sync with what's actually shown.
// ---------------------------------------------------------------------
function FeedHeader({ navigate, openCount, onPost, showBroadcastToggle, optedOut, onToggleOptOut }) {
  return (
    <div className="kx-errand-header">
      <div className="kx-errand-header-top">
        <button onClick={() => navigate('/services')} className="kx-errand-back" aria-label="সার্ভিসে ফিরে যান">
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="kx-errand-title">Pick and Drop</div>
          <div className="kx-errand-subtitle">
            {optedOut ? 'ব্রডকাস্ট বন্ধ আছে' : openCount > 0 ? `${openCount}টা রিকোয়েস্ট এখন খোলা আছে` : 'কারো কিছু আনা-নেওয়ার দরকার হলে এখানে দেখুন'}
          </div>
        </div>
        {showBroadcastToggle && (
          <button
            onClick={onToggleOptOut}
            className="kx-errand-back"
            aria-label={optedOut ? 'ব্রডকাস্ট চালু করুন' : 'ব্রডকাস্ট বন্ধ করুন'}
            title={optedOut ? 'ব্রডকাস্ট চালু করুন' : 'ব্রডকাস্ট বন্ধ করুন'}
          >
            {optedOut ? <BellOff size={18} /> : <Bell size={18} />}
          </button>
        )}
      </div>
      <div className="kx-errand-header-actions">
        <button onClick={onPost} className="btn btn-primary" style={{ flex: 1 }}>
          নতুন রিকোয়েস্ট দিন
        </button>
        <button
          onClick={() => navigate('/services/errands/mine')}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ListChecks size={16} /> আমার রিকোয়েস্ট
        </button>
      </div>
      <style>{`
        .kx-errand-header { margin-bottom: 18px; }
        .kx-errand-header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .kx-errand-back {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer;
        }
        .kx-errand-title { font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .kx-errand-subtitle { font-size: 13px; color: var(--muted); margin-top: 2px; }
        .kx-errand-header-actions { display: flex; gap: 8px; }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
// Feed card — item description, image, price/free badge, accept count,
// deadline. Accept count comes from a live subscribeErrandAccepts —
// deliberately NOT stored as a denormalized counter on the request doc
// itself (errandRequests.js keeps writes minimal/atomic per its own doc
// comment), so this reads the accepts subcollection directly per card.
// ---------------------------------------------------------------------
function ErrandCard({ req, onOpen }) {
  const [acceptCount, setAcceptCount] = useState(null);

  useEffect(() => subscribeErrandAccepts(req.id, (accepts) => {
    setAcceptCount(accepts.filter((a) => a.status === 'waiting' || a.status === 'confirmed').length);
  }), [req.id]);

  return (
    <div className="card kx-errand-card" onClick={onOpen}>
      {req.itemImageUrl ? (
        <img src={req.itemImageUrl} alt="" className="kx-errand-card-thumb" />
      ) : (
        <div className="kx-errand-card-icon"><Bike size={20} strokeWidth={1.75} /></div>
      )}
      <div className="kx-errand-card-body">
        <div className="kx-errand-card-top">
          <span className={`kx-errand-card-price${req.isFree ? ' is-free' : ''}`}>
            {req.isFree ? 'ফ্রি' : `৳${req.proposedPrice}`}
          </span>
          {req.deadlineAt && <ErrandDeadline deadlineAt={req.deadlineAt} />}
        </div>
        <div className="kx-errand-card-desc">{req.itemDescription}</div>
        <div className="kx-errand-card-meta">
          {req.requesterName || (req.requesterRole === 'faculty' ? 'একজন শিক্ষক' : 'একজন স্টুডেন্ট')}
          {acceptCount !== null && acceptCount > 0 && (
            <span className="kx-errand-card-accepts"> · {acceptCount} জন রাজি</span>
          )}
        </div>
      </div>
      <style>{`
        .kx-errand-card {
          display: flex; align-items: flex-start; gap: 12px; padding: 14px;
          cursor: pointer; transition: border-color 0.15s ease;
        }
        .kx-errand-card:hover { border-color: rgba(var(--accentRGB), 0.35); }
        .kx-errand-card-icon {
          width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--accentSoft); color: var(--accent);
        }
        .kx-errand-card-thumb {
          width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0; object-fit: cover;
          border: 1px solid var(--border);
        }
        .kx-errand-card-body { flex: 1; min-width: 0; }
        .kx-errand-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .kx-errand-card-price {
          font-size: 12px; font-weight: 800; color: var(--accent); background: var(--accentSoft);
          padding: 2px 8px; border-radius: 999px; flex-shrink: 0;
        }
        .kx-errand-card-price.is-free { color: #15803d; background: rgba(21,128,61,0.12); }
        .kx-errand-card-desc { font-size: 14.5px; font-weight: 700; color: var(--text); margin-top: 6px; }
        .kx-errand-card-meta { font-size: 12.5px; color: var(--muted); margin-top: 4px; }
        .kx-errand-card-accepts { color: var(--accent); font-weight: 700; }
      `}</style>
    </div>
  );
}

export function ErrandDeadline({ deadlineAt }) {
  const date = deadlineAt?.toDate ? deadlineAt.toDate() : new Date(deadlineAt);
  const text = date.toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <span className="kx-errand-deadline">
      <Clock size={11} style={{ marginRight: 3, verticalAlign: '-1.5px' }} />{text}
      <style>{`
        .kx-errand-deadline {
          font-size: 11px; color: var(--muted); white-space: nowrap; flex-shrink: 0;
        }
      `}</style>
    </span>
  );
}

// ---------------------------------------------------------------------
// Post form — item description, optional image, price/free, optional
// deadline.
//
// Image upload order (CORRECTED — see errandRequests.js's
// generateErrandRequestId/patchErrandRequestImage doc comments for the
// full reasoning): the doc must exist in Firestore BEFORE the image
// worker will authorize an upload against it (ownsErrandRequest reads
// the doc to check requesterUid), so this can't be "upload then create"
// the way a from-scratch design might assume. Real order:
//   1. generateErrandRequestId() — just a client-side id, no write yet
//   2. createOpenErrandRequest({ requestId, ... }) — doc created, open,
//      itemImageUrl still null
//   3. uploadServiceImage(requestId, file, 'errand') — now authorized,
//      since the doc from step 2 exists
//   4. patchErrandRequestImage(requestId, url) — the one narrow allowed
//      update path firestore.rules adds specifically for this
// Image upload/patch failure is non-blocking — the request itself is
// already posted after step 2, so a failed image shouldn't undo that.
// ---------------------------------------------------------------------
function PostRequestForm({ identity, onClose, onPosted }) {
  const [description, setDescription] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  const [deadline, setDeadline] = useState(''); // datetime-local string
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    setError('');
    if (!description.trim()) { setError('কী লাগবে সেটা লিখুন।'); return; }
    if (!isFree && (!price || Number(price) <= 0)) { setError('একটা মূল্য দিন, অথবা ফ্রি বেছে নিন।'); return; }

    setBusy(true);
    try {
      const deadlineAt = deadline ? new Date(deadline) : null;
      const requestId = imageFile ? generateErrandRequestId() : null;

      const createdId = await createOpenErrandRequest({
        requestId,
        requesterUid: identity.uid,
        requesterName: identity.name,
        requesterRole: identity.role,
        itemDescription: description,
        proposedPrice: isFree ? 0 : Number(price),
        deadlineAt,
      });

      if (imageFile) {
        try {
          const url = await uploadServiceImage(createdId, imageFile, 'errand');
          await patchErrandRequestImage(createdId, url);
        } catch (imgErr) {
          // Non-blocking — see this function's header comment.
          console.error('[ErrandFeed] image upload failed (non-blocking)', imgErr);
        }
      }

      onPosted(createdId);
    } catch (err) {
      setError(err?.message || 'রিকোয়েস্ট পোস্ট করতে সমস্যা হয়েছে।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card kx-errand-form" style={{ padding: 16 }}>
      <div className="kx-errand-form-header">
        <div className="kx-errand-form-title">নতুন রিকোয়েস্ট দিন</div>
        <button onClick={onClose} className="kx-errand-form-close" aria-label="বন্ধ করুন"><X size={18} /></button>
      </div>

      <label className="kx-errand-form-label">কী লাগবে?</label>
      <textarea
        className="kx-errand-form-textarea"
        placeholder="যেমন: হলের মেসে থেকে হল গেটে একটা টিফিন বক্স পৌঁছে দিতে হবে"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      <label className="kx-errand-form-label">ছবি (ঐচ্ছিক)</label>
      {imagePreview ? (
        <div className="kx-errand-form-image-wrap">
          <img src={imagePreview} alt="" className="kx-errand-form-image-preview" />
          <button onClick={() => { setImageFile(null); setImagePreview(null); }} className="kx-errand-form-image-remove" aria-label="ছবি সরান">
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className="kx-errand-form-image-picker">
          <Camera size={18} />
          <span>ছবি যোগ করুন</span>
          <input type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
        </label>
      )}

      <label className="kx-errand-form-label">মূল্য</label>
      <div className="kx-errand-form-price-row">
        <button
          type="button"
          className={`kx-errand-form-price-toggle${isFree ? ' active' : ''}`}
          onClick={() => setIsFree(true)}
        >
          ফ্রি
        </button>
        <button
          type="button"
          className={`kx-errand-form-price-toggle${!isFree ? ' active' : ''}`}
          onClick={() => setIsFree(false)}
        >
          টাকা দেব
        </button>
        {!isFree && (
          <input
            type="number"
            min="1"
            className="kx-errand-form-price-input"
            placeholder="৳ পরিমাণ"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        )}
      </div>

      <label className="kx-errand-form-label">সময়সীমা (ঐচ্ছিক)</label>
      <input
        type="datetime-local"
        className="kx-errand-form-input"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
      />

      {error && <div className="kx-errand-form-error">{error}</div>}

      <button onClick={handleSubmit} disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 14 }}>
        {busy ? 'পোস্ট হচ্ছে...' : 'রিকোয়েস্ট পোস্ট করুন'}
      </button>

      <style>{`
        .kx-errand-form-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .kx-errand-form-title { font-size: 16px; font-weight: 800; color: var(--text); }
        .kx-errand-form-close {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer;
        }
        .kx-errand-form-label { display: block; font-size: 12.5px; font-weight: 700; color: var(--muted); margin: 12px 0 6px; }
        .kx-errand-form-textarea, .kx-errand-form-input {
          width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border);
          background: var(--card); color: var(--text); font-size: 13.5px; font-family: inherit; resize: vertical;
        }
        .kx-errand-form-image-picker {
          display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px;
          border: 1px dashed var(--border); color: var(--muted); font-size: 13px; cursor: pointer;
        }
        .kx-errand-form-image-wrap { position: relative; width: 100%; max-width: 160px; }
        .kx-errand-form-image-preview { width: 100%; height: 110px; object-fit: cover; border-radius: 10px; border: 1px solid var(--border); }
        .kx-errand-form-image-remove {
          position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 999px;
          display: flex; align-items: center; justify-content: center;
          background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer;
        }
        .kx-errand-form-price-row { display: flex; gap: 8px; align-items: center; }
        .kx-errand-form-price-toggle {
          padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border); background: var(--card);
          color: var(--text); font-size: 13px; font-weight: 700; cursor: pointer; flex-shrink: 0;
        }
        .kx-errand-form-price-toggle.active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .kx-errand-form-price-input {
          flex: 1; padding: 8px 12px; border-radius: 999px; border: 1px solid var(--border);
          background: var(--card); color: var(--text); font-size: 13.5px;
        }
        .kx-errand-form-error {
          margin-top: 10px; padding: 10px 12px; border-radius: 10px; font-size: 13px;
          background: rgba(220,38,38,0.10); border: 1px solid rgba(220,38,38,0.30); color: var(--text);
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
// Detail modal — three views depending on the viewer's relationship to
// this request (person's explicit spec): requester (sees the accept
// queue + confirm/finish/cancel), confirmed acceptor (sees requester
// contact + finish), or anyone else browsing the open feed (sees an
// Accept button). All three subscribe to the same live request doc +
// accepts subcollection so every view stays in sync with whatever
// action any party takes elsewhere.
// ---------------------------------------------------------------------
export function RequestDetailModal({ requestId, identity, onClose }) {
  const [req, setReq] = useState(undefined); // undefined = loading, null = gone
  const [accepts, setAccepts] = useState([]);

  useEffect(() => subscribeErrandRequest(requestId, setReq), [requestId]);
  useEffect(() => subscribeErrandAccepts(requestId, setAccepts), [requestId]);

  if (req === undefined) {
    return <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>লোড হচ্ছে...</div>;
  }
  if (req === null) {
    return <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>এই রিকোয়েস্টটি আর নেই।</div>;
  }

  const isRequester = req.requesterUid === identity.uid;
  const myAccept = accepts.find((a) => a.id === identity.uid);
  const isConfirmedAcceptor = req.confirmedAcceptorUid === identity.uid;

  return (
    <div className="card kx-errand-detail" style={{ padding: 16 }}>
      <div className="kx-errand-form-header">
        <div className="kx-errand-form-title">রিকোয়েস্ট বিবরণ</div>
        <button onClick={onClose} className="kx-errand-form-close" aria-label="বন্ধ করুন"><X size={18} /></button>
      </div>

      {req.itemImageUrl && <img src={req.itemImageUrl} alt="" className="kx-errand-detail-image" />}

      <div className="kx-errand-detail-desc">{req.itemDescription}</div>
      <div className="kx-errand-detail-meta-row">
        <span className={`kx-errand-card-price${req.isFree ? ' is-free' : ''}`}>
          {req.isFree ? 'ফ্রি' : `৳${req.proposedPrice}`}
        </span>
        {req.deadlineAt && <ErrandDeadline deadlineAt={req.deadlineAt} />}
      </div>
      <div className="kx-errand-detail-poster">
        পোস্ট করেছেন: {req.requesterName || (req.requesterRole === 'faculty' ? 'একজন শিক্ষক' : 'একজন স্টুডেন্ট')}
      </div>

      {isRequester ? (
        <RequesterView req={req} accepts={accepts} onClose={onClose} />
      ) : isConfirmedAcceptor ? (
        <AcceptorConfirmedView req={req} onClose={onClose} />
      ) : (
        <AcceptView req={req} identity={identity} myAccept={myAccept} />
      )}

      <style>{`
        .kx-errand-detail-image {
          width: 100%; max-height: 200px; object-fit: cover; border-radius: 12px;
          border: 1px solid var(--border); margin-bottom: 12px;
        }
        .kx-errand-detail-desc { font-size: 15px; font-weight: 700; color: var(--text); }
        .kx-errand-detail-meta-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
        .kx-errand-detail-poster { font-size: 12.5px; color: var(--muted); margin-top: 8px; }
        .kx-errand-detail-section { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); }
        .kx-errand-detail-section-title { font-size: 12.5px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 10px; }
      `}</style>
    </div>
  );
}

// --- Requester's own view: accept queue + confirm/finish/cancel -------
function RequesterView({ req, accepts, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const waiting = accepts.filter((a) => a.status === 'waiting');
  const confirmed = accepts.find((a) => a.status === 'confirmed');

  const doConfirm = async (acceptorUid) => {
    setError(''); setBusy(true);
    try { await confirmErrandAcceptor(req.id, acceptorUid); }
    catch (err) { setError(err?.message || 'কনফার্ম করতে সমস্যা হয়েছে।'); }
    finally { setBusy(false); }
  };
  const doFinish = async () => {
    setError(''); setBusy(true);
    try { await finishErrandRequest(req.id); onClose(); }
    catch (err) { setError(err?.message || 'সমস্যা হয়েছে।'); setBusy(false); }
  };
  const doCancel = async () => {
    setError(''); setBusy(true);
    try { await cancelErrandRequest(req.id); onClose(); }
    catch (err) { setError(err?.message || 'সমস্যা হয়েছে।'); setBusy(false); }
  };

  return (
    <div className="kx-errand-detail-section">
      <div className="kx-errand-detail-section-title">যারা রাজি হয়েছেন</div>

      {req.status === 'confirmed' && confirmed ? (
        <div className="kx-errand-acceptor-row is-confirmed">
          <div>
            <div className="kx-errand-acceptor-name">{confirmed.acceptorName} <span className="kx-errand-confirmed-tag">কনফার্ম হয়েছে</span></div>
            <div className="kx-errand-acceptor-phone">{confirmed.acceptorPhone}</div>
          </div>
        </div>
      ) : waiting.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>এখনো কেউ রাজি হননি।</div>
      ) : (
        waiting.map((a) => (
          <div key={a.id} className="kx-errand-acceptor-row">
            <div>
              <div className="kx-errand-acceptor-name">{a.acceptorName}</div>
              <div className="kx-errand-acceptor-phone">{a.acceptorPhone}</div>
            </div>
            <button onClick={() => doConfirm(a.acceptorUid)} disabled={busy} className="btn btn-sm btn-primary">
              কনফার্ম করুন
            </button>
          </div>
        ))
      )}

      {error && <div className="kx-errand-form-error" style={{ marginTop: 10 }}>{error}</div>}

      {(req.status === 'open' || req.status === 'confirmed') && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {req.status === 'confirmed' && (
            <button onClick={doFinish} disabled={busy} className="btn btn-primary" style={{ flex: 1 }}>শেষ হয়েছে</button>
          )}
          <button onClick={doCancel} disabled={busy} className="btn btn-secondary" style={{ flex: 1 }}>
            {busy ? '...' : 'রিকোয়েস্ট বাতিল করুন'}
          </button>
        </div>
      )}

      <style>{`
        .kx-errand-acceptor-row {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 10px 0; border-bottom: 1px solid var(--border);
        }
        .kx-errand-acceptor-row:last-child { border-bottom: none; }
        .kx-errand-acceptor-name { font-size: 13.5px; font-weight: 700; color: var(--text); }
        .kx-errand-acceptor-phone { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
        .kx-errand-confirmed-tag {
          font-size: 10.5px; font-weight: 800; color: #15803d; background: rgba(21,128,61,0.12);
          padding: 2px 7px; border-radius: 999px; margin-left: 6px;
        }
      `}</style>
    </div>
  );
}

// --- Confirmed acceptor's own view: requester contact + finish --------
function AcceptorConfirmedView({ req, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const doFinish = async () => {
    setError(''); setBusy(true);
    try { await finishErrandRequest(req.id); onClose(); }
    catch (err) { setError(err?.message || 'সমস্যা হয়েছে।'); setBusy(false); }
  };

  return (
    <div className="kx-errand-detail-section">
      <div className="kx-errand-detail-section-title">আপনি কনফার্ম হয়েছেন</div>
      <div style={{ fontSize: 13.5, color: 'var(--text)' }}>
        {req.requesterName || 'রিকোয়েস্টার'}-এর সাথে যোগাযোগ করে জিনিসটা পৌঁছে দিন।
      </div>
      {error && <div className="kx-errand-form-error" style={{ marginTop: 10 }}>{error}</div>}
      {req.status === 'confirmed' && (
        <button onClick={doFinish} disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
          {busy ? '...' : 'শেষ হয়েছে, মার্ক করুন'}
        </button>
      )}
    </div>
  );
}

// --- Any other verified account browsing the feed: Accept -------------
function AcceptView({ req, identity, myAccept }) {
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const startAccept = async () => {
    setError('');
    try {
      const saved = await getSavedErrandPhone(identity.uid);
      setPhone(saved || '');
    } catch { /* ignore — phone field just starts empty */ }
    setShowPhoneForm(true);
  };

  const submitAccept = async () => {
    setError('');
    if (!phone.trim()) { setError('একটা ফোন নাম্বার দিন।'); return; }
    setBusy(true);
    try {
      await acceptErrandRequest(req.id, {
        acceptorUid: identity.uid,
        acceptorName: identity.name,
        acceptorPhone: phone,
        acceptorIsFaculty: identity.isFaculty,
      });
      setShowPhoneForm(false);
    } catch (err) {
      setError(err?.message || 'সমস্যা হয়েছে।');
    } finally {
      setBusy(false);
    }
  };

  if (req.status !== 'open') {
    return (
      <div className="kx-errand-detail-section">
        <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>এই রিকোয়েস্টটি আর খোলা নেই।</div>
      </div>
    );
  }

  if (myAccept) {
    return (
      <div className="kx-errand-detail-section">
        <div style={{ fontSize: 13.5, color: 'var(--text)' }}>
          আপনি রাজি হয়েছেন — {myAccept.acceptorPhone}। রিকোয়েস্টার কনফার্ম করলে এখানে জানানো হবে।
        </div>
      </div>
    );
  }

  return (
    <div className="kx-errand-detail-section">
      {showPhoneForm ? (
        <>
          <label className="kx-errand-form-label" style={{ marginTop: 0 }}>ফোন নাম্বার</label>
          <input
            type="tel"
            className="kx-errand-form-input"
            placeholder="০১XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {error && <div className="kx-errand-form-error" style={{ marginTop: 10 }}>{error}</div>}
          <button onClick={submitAccept} disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
            {busy ? 'পাঠানো হচ্ছে...' : 'রাজি আছি, নিশ্চিত করুন'}
          </button>
        </>
      ) : (
        <button onClick={startAccept} className="btn btn-primary" style={{ width: '100%' }}>
          আমি এটা করতে পারব
        </button>
      )}
    </div>
  );
}
