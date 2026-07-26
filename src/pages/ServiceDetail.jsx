// ServiceDetail.jsx
//
// PHASE 2 (SERVICES_PROVIDER_PLAN.md §6). Detail page reached from
// Services.jsx. Display order is exactly the spec's: title -> price ->
// description. Booking form uses native <input type="date"> /
// <input type="time"> for preferredTime — structured, never free text
// (Gap 10) — and preferredTime itself stays fully optional.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Store, Circle, ArrowLeft } from 'lucide-react';
import { auth } from '../lib/firebase';
import { getProfile } from '../store/store';
import {
  subscribeService, createBooking, subscribeMyBookingsForService, cancelBooking,
} from '../lib/serviceSync';

const STATUS_LABEL = {
  pending: 'অপেক্ষমান',
  confirmed: 'কনফার্ম হয়েছে',
  done: 'সম্পন্ন হয়েছে',
  cancelled: 'বাতিল হয়েছে',
  expired_shop_closed: 'দোকান বন্ধ থাকায় বাতিল হয়েছে',
};

export default function ServiceDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(undefined); // undefined = loading, null = not found
  const [myBookings, setMyBookings] = useState(null);

  useEffect(() => subscribeService(serviceId, setService), [serviceId]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;
    return subscribeMyBookingsForService(serviceId, uid, setMyBookings);
  }, [serviceId]);

  if (service === undefined) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>;
  }

  if (service === null) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
        এই সার্ভিসটি খুঁজে পাওয়া যায়নি।
        <div style={{ marginTop: 12 }}>
          <button onClick={() => navigate('/services')} className="btn btn-sm">Back to Services</button>
        </div>
      </div>
    );
  }

  const activeBooking = (myBookings || []).find((b) => b.status === 'pending' || b.status === 'confirmed');

  return (
    <div style={{ padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
      <button onClick={() => navigate('/services')} className="btn btn-sm" style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={14} /> Services
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: 'var(--accentSoft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Store size={22} color="var(--accent)" />
        </div>
        {/* title (§6 order: title -> price -> description) */}
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{service.name}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Circle size={9} fill={service.isOpen ? '#16a34a' : '#9ca3af'} color={service.isOpen ? '#16a34a' : '#9ca3af'} />
        <span style={{ fontSize: 13, fontWeight: 700, color: service.isOpen ? '#16a34a' : 'var(--muted)' }}>
          {service.isOpen ? 'এখন খোলা' : 'এখন বন্ধ'}
        </span>
      </div>

      {/* price */}
      {service.priceNote && (
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>{service.priceNote}</div>
      )}

      {/* description */}
      {service.description && (
        <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>{service.description}</div>
      )}

      {myBookings === null ? null : activeBooking ? (
        <MyActiveBooking serviceId={serviceId} booking={activeBooking} />
      ) : (
        <BookingForm service={service} />
      )}
    </div>
  );
}

function MyActiveBooking({ serviceId, booking }) {
  const [cancelling, setCancelling] = useState(false);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancelBooking(serviceId, booking.id, 'student');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>আপনার বুকিং</div>
      <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>
        Status: <strong style={{ color: 'var(--text)' }}>{STATUS_LABEL[booking.status] || booking.status}</strong>
      </div>
      {booking.preferredTime && (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          পছন্দের সময়: {booking.preferredTime.date} at {booking.preferredTime.time}
        </div>
      )}
      {booking.confirmedSlot && (
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
          কনফার্ম করা সময়: {booking.confirmedSlot.date} at {booking.confirmedSlot.time}
        </div>
      )}
      <button onClick={doCancel} disabled={cancelling} className="btn btn-sm btn-secondary" style={{ marginTop: 12 }}>
        {cancelling ? 'বাতিল হচ্ছে…' : 'বুকিং বাতিল করুন'}
      </button>
    </div>
  );
}

function BookingForm({ service }) {
  const profile = getProfile();
  const [offeringId, setOfferingId] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [wantsPreferredTime, setWantsPreferredTime] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const availableOfferings = (service.offerings || []).filter((o) => o.isAvailable);

  const submit = async () => {
    setError('');
    if (!service.isOpen) {
      setError('দোকান এখন বন্ধ — এখন বুক করা যাবে না।');
      return;
    }
    if (!offeringId) {
      setError('একটা offering সিলেক্ট করুন।');
      return;
    }
    if (!studentPhone.trim()) {
      setError('ফোন নাম্বার দিন।');
      return;
    }
    if (wantsPreferredTime && (!date || !time)) {
      setError('তারিখ এবং সময় দুটোই দিতে হবে, অথবা preferred time অপশনটা বন্ধ রাখুন।');
      return;
    }

    setSubmitting(true);
    try {
      await createBooking(service.id, {
        studentUid: auth.currentUser.uid,
        studentName: profile?.name || '',
        studentPhone,
        offeringId,
        preferredTime: wantsPreferredTime ? { date, time } : null,
      });
      setDone(true);
    } catch (e) {
      setError(e.message || 'বুক করতে সমস্যা হয়েছে।');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>বুকিং পাঠানো হয়েছে ✓</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
          Owner কনফার্ম করলে এখানেই দেখতে পাবেন।
        </div>
      </div>
    );
  }

  if (!service.isOpen) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        দোকান এখন বন্ধ — খোলা হলে এখান থেকেই বুক করতে পারবেন।
      </div>
    );
  }

  if (availableOfferings.length === 0) {
    return (
      <div className="card" style={{ padding: 16, textAlign: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
        এখন কোনো offering available নেই।
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>বুক করুন</div>

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Offering</label>
      <select
        value={offeringId}
        onChange={(e) => setOfferingId(e.target.value)}
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      >
        <option value="">সিলেক্ট করুন</option>
        {availableOfferings.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>

      <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>ফোন নাম্বার</label>
      <input
        value={studentPhone}
        onChange={(e) => setStudentPhone(e.target.value)}
        placeholder="01XXXXXXXXX"
        style={{
          width: '100%', marginTop: 6, marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14,
        }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
        <input type="checkbox" checked={wantsPreferredTime} onChange={(e) => setWantsPreferredTime(e.target.checked)} />
        পছন্দের সময় দিতে চান? (ঐচ্ছিক)
      </label>

      {wantsPreferredTime && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{
            flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          }}
          />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{
            flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--text)', fontSize: 14,
          }}
          />
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{error}</div>}

      <button onClick={submit} disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
        {submitting ? 'পাঠানো হচ্ছে…' : 'বুক করুন'}
      </button>
    </div>
  );
}
