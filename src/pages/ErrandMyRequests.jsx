// ErrandMyRequests.jsx
//
// "My Requests" / "My Accepted" — /services/errands/mine. Two tabs:
//   - requests I posted (any status)   — subscribeMyErrandRequests
//   - requests I accepted (any status) — subscribeMyAcceptedErrandRequests
//
// Reuses ServiceOrdersHub.jsx's established card+modal pattern (grouped
// active/done/closed sections, progress bar, tap-card-to-open-modal) —
// but reads from errandRequests.js's own collections, and for the modal
// itself reuses ErrandFeed.jsx's RequestDetailModal directly rather than
// re-implementing the three-view (requester/acceptor/browser) logic a
// second time in this file.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bike, Package } from 'lucide-react';
import {
  subscribeMyErrandRequests, subscribeMyAcceptedErrandRequests,
} from '../lib/errandRequests';
import { useRequesterIdentity, RequestDetailModal, ErrandDeadline } from './ErrandFeed';
import Modal from '../components/Modal';

const STATUS_TEXT = {
  open: 'খোলা আছে, কারো অপেক্ষায়',
  confirmed: 'কনফার্ম হয়েছে',
  finished: 'শেষ হয়েছে',
  cancelled: 'বাতিল হয়েছে',
};

const ACTIVE_STATUSES = ['open', 'confirmed'];
const DONE_STATUSES = ['finished'];

function bucketFor(status) {
  if (ACTIVE_STATUSES.includes(status)) return 'active';
  if (DONE_STATUSES.includes(status)) return 'done';
  return 'closed'; // cancelled
}

const PROGRESS_STEPS = { open: 20, confirmed: 70, finished: 100, cancelled: 100 };

export default function ErrandMyRequests() {
  const navigate = useNavigate();
  const identity = useRequesterIdentity();
  const [tab, setTab] = useState('posted'); // 'posted' | 'accepted'
  const [posted, setPosted] = useState(null);
  const [accepted, setAccepted] = useState(null);
  const [openRequestId, setOpenRequestId] = useState(null);

  useEffect(() => subscribeMyErrandRequests(identity.uid, setPosted), [identity.uid]);
  useEffect(() => subscribeMyAcceptedErrandRequests(identity.uid, setAccepted), [identity.uid]);

  // Both tabs normalize to the same {id, status, itemDescription,
  // itemImageUrl, proposedPrice, isFree, deadlineAt} shape the card
  // needs — "accepted" entries pull those fields from the nested
  // `.request` the subscription already joins in, so one card
  // component below serves both tabs without a kind-branch.
  const postedList = posted || [];
  const acceptedList = useMemo(
    () => (accepted || []).filter((a) => a.request).map((a) => ({ ...a.request, myAcceptStatus: a.status })),
    [accepted],
  );

  const list = tab === 'posted' ? postedList : acceptedList;
  const grouped = useMemo(() => {
    const buckets = { active: [], done: [], closed: [] };
    list.forEach((r) => buckets[bucketFor(r.status)].push(r));
    return buckets;
  }, [list]);

  const loading = tab === 'posted' ? posted === null : accepted === null;
  const isEmpty = !loading && grouped.active.length === 0 && grouped.done.length === 0 && grouped.closed.length === 0;

  return (
    <div className="page-enter page-container content-page-bg">
      <MyRequestsHeader navigate={navigate} />

      <div className="kx-mine-tabs">
        <button className={`kx-mine-tab${tab === 'posted' ? ' active' : ''}`} onClick={() => setTab('posted')}>
          আমার পোস্ট করা
        </button>
        <button className={`kx-mine-tab${tab === 'accepted' ? ' active' : ''}`} onClick={() => setTab('accepted')}>
          আমি রাজি হয়েছি
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card kx-mine-skeleton" style={{ padding: 16, height: 84 }} />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="card kx-mine-empty">
          <Package size={36} strokeWidth={1.5} />
          <div style={{ fontWeight: 700, marginTop: 10 }}>
            {tab === 'posted' ? 'এখনো কোনো রিকোয়েস্ট পোস্ট করেননি' : 'এখনো কোনো রিকোয়েস্টে রাজি হননি'}
          </div>
        </div>
      ) : (
        <>
          <MineSection title="চলমান" records={grouped.active} onOpen={setOpenRequestId} />
          <MineSection title="সম্পন্ন" records={grouped.done} onOpen={setOpenRequestId} />
          <MineSection title="বাতিল" records={grouped.closed} onOpen={setOpenRequestId} />
        </>
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
        .kx-mine-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .kx-mine-tab {
          flex: 1; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border);
          background: var(--card); color: var(--muted); font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .kx-mine-tab.active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .kx-mine-skeleton { animation: kxMinePulse 1.1s ease-in-out infinite; }
        @keyframes kxMinePulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        .kx-mine-empty {
          padding: 40px 20px; text-align: center; color: var(--muted);
          display: flex; flex-direction: column; align-items: center;
        }
      `}</style>
    </div>
  );
}

function MyRequestsHeader({ navigate }) {
  return (
    <div className="kx-mine-header">
      <button onClick={() => navigate('/services/errands')} className="kx-mine-back" aria-label="ফিডে ফিরে যান">
        <ArrowLeft size={18} />
      </button>
      <div>
        <div className="kx-mine-title">আমার রিকোয়েস্ট</div>
        <div className="kx-mine-subtitle">যা পোস্ট করেছেন বা যাতে রাজি হয়েছেন, সবকিছু এখানে</div>
      </div>
      <style>{`
        .kx-mine-header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .kx-mine-back {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer;
        }
        .kx-mine-title { font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .kx-mine-subtitle { font-size: 13px; color: var(--muted); margin-top: 2px; }
      `}</style>
    </div>
  );
}

function MineSection({ title, records, onOpen }) {
  if (records.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="kx-mine-section-title">{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {records.map((r) => <MineCard key={r.id} req={r} onOpen={() => onOpen(r.id)} />)}
      </div>
      <style>{`
        .kx-mine-section-title {
          font-size: 12.5px; font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase;
          color: var(--muted); margin-bottom: 10px;
        }
      `}</style>
    </div>
  );
}

function MineCard({ req, onOpen }) {
  const statusText = STATUS_TEXT[req.status] || req.status;
  const progress = PROGRESS_STEPS[req.status] ?? 0;

  return (
    <div className="card kx-mine-card" onClick={onOpen}>
      {req.itemImageUrl ? (
        <img src={req.itemImageUrl} alt="" className="kx-mine-card-thumb" />
      ) : (
        <div className="kx-mine-card-icon"><Bike size={20} strokeWidth={1.75} /></div>
      )}
      <div className="kx-mine-card-body">
        <div className="kx-mine-card-top">
          <span className={`kx-mine-card-price${req.isFree ? ' is-free' : ''}`}>
            {req.isFree ? 'ফ্রি' : `৳${req.proposedPrice}`}
          </span>
          {req.deadlineAt && <ErrandDeadline deadlineAt={req.deadlineAt} />}
        </div>
        <div className="kx-mine-card-desc">{req.itemDescription}</div>
        <div className="kx-mine-card-status">{statusText}</div>
        <div className="kx-mine-card-progress-track">
          <div className="kx-mine-card-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <style>{`
        .kx-mine-card {
          display: flex; align-items: flex-start; gap: 12px; padding: 14px;
          cursor: pointer; transition: border-color 0.15s ease;
        }
        .kx-mine-card:hover { border-color: rgba(var(--accentRGB), 0.35); }
        .kx-mine-card-icon {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--accentSoft); color: var(--accent);
        }
        .kx-mine-card-thumb {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; object-fit: cover;
          border: 1px solid var(--border);
        }
        .kx-mine-card-body { flex: 1; min-width: 0; }
        .kx-mine-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .kx-mine-card-price {
          font-size: 12px; font-weight: 800; color: var(--accent); background: var(--accentSoft);
          padding: 2px 8px; border-radius: 999px; flex-shrink: 0;
        }
        .kx-mine-card-price.is-free { color: #15803d; background: rgba(21,128,61,0.12); }
        .kx-mine-card-desc { font-size: 14px; font-weight: 700; color: var(--text); margin-top: 6px; }
        .kx-mine-card-status { font-size: 12.5px; color: var(--muted); margin-top: 3px; }
        .kx-mine-card-progress-track {
          height: 4px; border-radius: 999px; background: var(--border); margin-top: 8px; overflow: hidden;
        }
        .kx-mine-card-progress-fill {
          height: 100%; background: var(--accent); border-radius: 999px; transition: width 0.2s ease;
        }
      `}</style>
    </div>
  );
}
