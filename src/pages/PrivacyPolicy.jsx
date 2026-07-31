// PrivacyPolicy.jsx
//
// TRIAL / PLACEHOLDER CONTENT — Akhinoor asked for a generic policy page
// to exist now (so the Role Select checkbox and the hamburger menu's
// "See our privacy policy →" link — see Navbar.jsx — both have somewhere
// real to point to instead of a dead /privacy route), with the actual
// KUETx-specific Privacy Policy + Terms & Conditions text to be dropped
// in and organized once he provides it. Nothing below should be treated
// as final legal copy — swap the section bodies, not the page structure,
// when the real content arrives.
//
// Publicly reachable (no auth/role guard) since a brand-new account still
// mid-onboarding (Role Select) needs to open this link before finishing
// signup.

import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const SECTION_STYLE = { marginBottom: 26 };
const HEADING_STYLE = { fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 };
const BODY_STYLE = { fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.8 };

export default function PrivacyPolicy() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      padding: '32px 18px 60px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: 'var(--muted)', textDecoration: 'none', marginBottom: 20,
          }}
        >
          <ArrowLeft size={15} /> ফিরে যান
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Shield size={22} color="var(--accent)" />
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
            গোপনীয়তা নীতি ও শর্তাবলী
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 28 }}>
          KUETx — Student Life OS · সর্বশেষ আপডেট: খসড়া সংস্করণ
        </div>

        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '20px 22px', marginBottom: 28,
          fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7,
        }}>
          এই পেজটি এখনো খসড়া/placeholder অবস্থায় আছে। এখানে সাধারণ কিছু নীতিমালা
          দেওয়া আছে যাতে সাইনআপ এবং নেভিগেশন মেনু থেকে লিংকটি কাজ করে। KUETx-এর
          চূড়ান্ত ও বিস্তারিত Privacy Policy ও Terms &amp; Conditions শীঘ্রই এখানে
          যুক্ত করা হবে।
        </div>

        <div style={SECTION_STYLE}>
          <div style={HEADING_STYLE}>১. আমরা কী তথ্য সংগ্রহ করি</div>
          <div style={BODY_STYLE}>
            KUETx আপনার একাডেমিক তথ্য (কোর্স, ক্লাস রুটিন, পরীক্ষার ফলাফল, উপস্থিতি),
            প্রোফাইল তথ্য (নাম, বিভাগ, ইমেইল), এবং সার্ভিস প্রোভাইডার হিসেবে সাইন আপ
            করলে ফোন নাম্বার ও দোকানের ঠিকানার মতো তথ্য সংগ্রহ করে, শুধুমাত্র অ্যাপের
            মূল ফিচারগুলো সচল রাখার জন্য।
          </div>
        </div>

        <div style={SECTION_STYLE}>
          <div style={HEADING_STYLE}>২. তথ্য কীভাবে ব্যবহার করা হয়</div>
          <div style={BODY_STYLE}>
            আপনার তথ্য শুধুমাত্র KUETx-এর সার্ভিস প্রদানের জন্য ব্যবহার করা হয় —
            যেমন ড্যাশবোর্ড দেখানো, নোটিশ পাঠানো, বা সার্ভিস প্রোভাইডার ভেরিফিকেশন।
            কোনো তৃতীয় পক্ষের কাছে বিজ্ঞাপনী উদ্দেশ্যে তথ্য বিক্রি বা শেয়ার করা হয় না।
          </div>
        </div>

        <div style={SECTION_STYLE}>
          <div style={HEADING_STYLE}>৩. তথ্য সংরক্ষণ</div>
          <div style={BODY_STYLE}>
            আপনার তথ্য Firebase/Firestore-এ নিরাপদে সংরক্ষিত থাকে। অ্যাকাউন্ট মুছে
            ফেললে সংশ্লিষ্ট তথ্যও মুছে ফেলার ব্যবস্থা রাখা হয়।
          </div>
        </div>

        <div style={SECTION_STYLE}>
          <div style={HEADING_STYLE}>৪. সার্ভিস প্রোভাইডারদের জন্য শর্তাবলী</div>
          <div style={BODY_STYLE}>
            সার্ভিস প্রোভাইডার হিসেবে নিবন্ধনের জন্য প্রদত্ত তথ্য (নাম, ফোন নাম্বার,
            সার্ভিসের ধরন, ঠিকানা) শুধুমাত্র Founder/Admin কর্তৃক ভেরিফিকেশনের
            উদ্দেশ্যে ব্যবহৃত হয়। ভুল বা বিভ্রান্তিকর তথ্য দেওয়া হলে অনুরোধ প্রত্যাখ্যাত
            হতে পারে।
          </div>
        </div>

        <div style={SECTION_STYLE}>
          <div style={HEADING_STYLE}>৫. যোগাযোগ</div>
          <div style={BODY_STYLE}>
            এই নীতিমালা সংক্রান্ত কোনো প্রশ্ন থাকলে KUETx Founder-এর সাথে যোগাযোগ
            করুন।
          </div>
        </div>
      </div>
    </div>
  );
}
