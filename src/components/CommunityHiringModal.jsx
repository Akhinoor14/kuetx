import React, { useState } from 'react';
import { X, Users, MessageCircle, ArrowRight, ClipboardList, CheckCircle2 } from 'lucide-react';
import campusLeadPoster from '../assets/campus_Lead_KUETx_Individual_Hiring_Posters.jpg';

const WHATSAPP_NUMBER = '8801724812042'; // 01724812042 in intl format
const WHATSAPP_MESSAGE =
  "আসসালামু আলাইকুম। আমি KUETx-এর Campus Lead পদের জন্য Apply করতে চাই।\n\nনাম:\nডিপার্টমেন্ট:\nব্যাচ:\nকেন এই role-এর জন্য উপযুক্ত মনে করি:\n";

function buildWhatsappLink() {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}

const COMMUNITY_POINTS = [
  { icon: '📅', title: 'একসাথে Routine', body: 'তোমার ব্যাচ+ডিপার্টমেন্টের সবাই একই routine দেখবে ও আপডেট থাকবে।' },
  { icon: '📝', title: 'শেয়ারড Assignment', body: 'একজন আপডেট দিলে ক্লাসের সবাই সাথে সাথে দেখতে পাবে — কে, কখন আপডেট করলো তাও দেখাবে।' },
  { icon: '📣', title: 'Notice Broadcast', body: 'CR/Campus Lead থেকে জরুরি নোটিশ সরাসরি তোমার ক্লাস গ্রুপে পৌঁছাবে।' },
  { icon: '🤝', title: 'Class Community', body: 'তোমার ব্যাচ+ডিপার্টমেন্টের সবার সাথে একটামাত্র জায়গায় কানেক্টেড থাকবে।' },
];

export default function CommunityHiringModal({ open: openProp, onClose } = {}) {
  const [page, setPage] = useState(1);
  if (openProp === false) return null;

  const dismiss = () => onClose?.();
  const next = () => setPage(2);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 3999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }} onClick={dismiss} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}>
        <div onClick={e => e.stopPropagation()} style={{
          pointerEvents: 'auto', width: '100%', maxWidth: 500,
          maxHeight: 'calc(100dvh - 40px)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 32px 80px rgba(0,0,0,0.26)',
          overflow: 'hidden',
        }}>

          {page === 1 ? (
            <>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, #1e40af) 100%)',
                padding: '22px 20px 20px', flexShrink: 0, position: 'relative',
              }}>
                <button onClick={dismiss} style={{
                  position: 'absolute', top: 14, right: 14,
                  background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
                  color: '#fff', borderRadius: 8, width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={14} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Users size={15} color="rgba(255,255,255,0.85)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '1.1px', textTransform: 'uppercase' }}>
                    নতুন ফিচার
                  </span>
                </div>
                <div style={{ fontSize: 21, fontWeight: 800, color: '#fff', fontFamily: 'Sora, sans-serif', marginBottom: 4 }}>
                  Class Community আসছে! 🎉
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                  তোমার ব্যাচ ও ডিপার্টমেন্টের সবাই এখন একসাথে কানেক্টেড থাকতে পারবে।
                </div>
              </div>

              {/* Points */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {COMMUNITY_POINTS.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 11, padding: '11px 12px',
                      borderRadius: 12, border: '1px solid var(--border)',
                      background: 'var(--surface)', alignItems: 'flex-start',
                    }}>
                      <div style={{ fontSize: 19, flexShrink: 0, marginTop: 1 }}>{p.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{p.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{p.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 16px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <button className="btn btn-primary" onClick={next} style={{ width: '100%', justifyContent: 'center', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  পরবর্তী <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #15803d 0%, #14532d 100%)',
                padding: '20px 20px 18px', flexShrink: 0, position: 'relative',
              }}>
                <button onClick={dismiss} style={{
                  position: 'absolute', top: 14, right: 14,
                  background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
                  color: '#fff', borderRadius: 8, width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={14} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <ClipboardList size={15} color="rgba(255,255,255,0.85)" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '1.1px', textTransform: 'uppercase' }}>
                    KUETx is hiring
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'Sora, sans-serif' }}>
                  Campus Lead হতে চাও? 🚀
                </div>
              </div>

              {/* Poster + WhatsApp CTA */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <img
                  src={campusLeadPoster}
                  alt="Campus Lead Hiring Poster"
                  style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', display: 'block', marginBottom: 14 }}
                />

                <div style={{
                  padding: '11px 13px', borderRadius: 10,
                  background: 'color-mix(in srgb, #25D366 10%, var(--surface))',
                  border: '1px solid color-mix(in srgb, #25D366 30%, var(--border))',
                  display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5,
                }}>
                  <CheckCircle2 size={15} color="#25D366" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Apply বাটনে ক্লিক করলে সরাসরি WhatsApp-এ একটা ready-made মেসেজ ওপেন হবে — নাম, ডিপার্টমেন্ট, ব্যাচ বসিয়ে সেন্ড করে দিলেই আবেদন সম্পন্ন।</span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 16px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
                <button onClick={dismiss} className="btn" style={{ flexShrink: 0, fontSize: 13 }}>
                  পরে
                </button>
                <a
                  href={buildWhatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={dismiss}
                  className="btn btn-primary"
                  style={{
                    flex: 1, justifyContent: 'center', fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                    background: '#25D366', borderColor: '#25D366',
                  }}
                >
                  <MessageCircle size={15} /> Apply করো (WhatsApp)
                </a>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
