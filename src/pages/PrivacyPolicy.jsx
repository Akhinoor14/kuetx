// PrivacyPolicy.jsx
//
// Real Privacy Policy + Terms & Conditions content, sourced from the
// KUETx Manifesto v1.1 (August 2026) — Sections 2, 3, 6, 7, 8, 9, 11.
// Bangla by default, with an English toggle button (no route change,
// no separate settings — just a button that flips PrivacyPolicyBody's
// language state). Replaces the earlier trial/placeholder copy.
//
// Publicly reachable (no auth/role guard) since a brand-new account still
// mid-onboarding (Role Select) needs to see this before finishing signup.
//
// BUGFIX: this used to be the ONLY way to read the policy — RoleSelectScreen's
// checkbox opened this page's route in a new browser tab (target="_blank"),
// which reads as an accidental redirect rather than a deliberate "read the
// terms" popup, and stranded people in a second tab mid-signup. The body
// content is split out as PrivacyPolicyBody below so RoleSelectScreen can
// render the exact same text inside an in-app Modal popup instead — the
// full /privacy route (used by the Navbar link, which isn't mid-onboarding
// and is fine navigating away) still wraps that body with page chrome
// (back link, full-height background) via the default export below.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const SECTION_STYLE = { marginBottom: 26 };
const HEADING_STYLE = { fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 };
const BODY_STYLE = { fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.8 };
const LIST_STYLE = { fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.8, margin: '6px 0 0', paddingLeft: 20 };
const SUBHEAD_STYLE = { fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginTop: 14, marginBottom: 4 };

// Every section's text in both languages. Keyed by the same section ids
// on both sides so nothing drifts out of sync between bn/en — if a
// section is added or reworded, update both entries here together.
const CONTENT = {
  bn: {
    pageTitle: 'গোপনীয়তা নীতি ও শর্তাবলী',
    subtitle: 'KUETx — Student Life OS · KUETx ম্যানিফেস্টো v1.1 (আগস্ট ২০২৬) অনুসারে',
    intro: "আমরা বিশ্বাস করি গোপনীয়তা নীতি অস্পষ্ট শর্তাবলীর আড়ালে লুকিয়ে রাখার কিছু নয় — এই পুরো পেজটি KUETx-এর সরকারি ম্যানিফেস্টো থেকে নেওয়া।",
    langToggleLabel: 'English',
    backLabel: 'ফিরে যান',
    sections: [
      {
        heading: '১. আমরা কী তথ্য সংগ্রহ করি',
        list: [
          'শিক্ষার্থীরা নিজে যা প্রবেশ করান এমন একাডেমিক তথ্য: রুটিন, উপস্থিতির রেকর্ড, বিভাগ/ব্যাচ',
          'অ্যাপ অভিজ্ঞতা ব্যক্তিগত করতে প্রয়োজনীয় বেসিক প্রোফাইল তথ্য',
          'ফ্যাকাল্টির জন্য: ফ্যাকাল্টি পোর্টাল চালাতে প্রয়োজনীয় ক্লাস, রুটিন ও ভেরিফিকেশন তথ্য',
          'সার্ভিস প্রোভাইডারদের জন্য: Services মার্কেটপ্লেসে লিস্ট ও পরিচালনা করতে প্রয়োজনীয় ব্যবসা/যোগাযোগের তথ্য',
        ],
      },
      {
        heading: '২. KUETx যা করে না',
        list: [
          'কোনো পরিস্থিতিতেই শিক্ষার্থীর তথ্য তৃতীয় পক্ষ, স্পনসর, বা বিজ্ঞাপনদাতার কাছে বিক্রি বা শেয়ার করে না',
          'একাডেমিক তথ্য যে ফিচারের জন্য দেওয়া হয়েছে, তার বাইরে অন্য কোনো কাজে ব্যবহার করে না',
          'মূল একাডেমিক ফিচারে (রুটিন, উপস্থিতি, প্রশ্নব্যাংক) স্পনসর কনটেন্ট বা ট্র্যাকিং প্রবেশ করায় না',
        ],
      },
      {
        heading: '৩. কারা শিক্ষার্থীর তথ্যে প্রবেশাধিকার পায়',
        body: 'ডেটা অ্যাক্সেস রোল-স্কোপড এবং ডেটাবেজ স্তরে (Firestore security rules) প্রয়োগ করা হয়, শুধু UI-তে লুকানো নয়:',
        list: [
          'Data & Systems Lead ও Backend Engineer — অ্যাপ চালু রাখার জন্য সম্পূর্ণ ইনফ্রাস্ট্রাকচার অ্যাক্সেস',
          'Admin / Head of Operations — অ্যাকাউন্ট প্রশাসনের প্রয়োজনে শিক্ষার্থীর নিজের প্রোফাইল ডকুমেন্ট পড়তে পারেন',
          'ক্লাস গ্রুপের সদস্যরা (CR/ACR সহ) — নিজেদের ক্লাসের গ্রুপ-লেভেল তথ্য দেখতে পারেন; একজন শিক্ষার্থীর নিজস্ব প্রোফাইল ডকুমেন্ট অন্যথায় শুধুমাত্র তার নিজের জন্য',
          'ফ্যাকাল্টি — ফ্যাকাল্টি পোর্টালের মাধ্যমে তাদের ক্লাস ও সংশ্লিষ্ট তথ্যেই সীমাবদ্ধ অ্যাক্সেস',
          'সার্ভিস প্রোভাইডার — একজন প্রোভাইডারের যোগাযোগ নম্বর তখনই একজন শিক্ষার্থীকে দেখানো হয় যখন সেই শিক্ষার্থীর সাথে কনফার্মড (বা সম্পন্ন) বুকিং থাকে — আগে নয়',
        ],
        footer: 'এই সেকশনটি বর্তমান ডেটা-অ্যাক্সেস মডেলের একটি উচ্চ-স্তরের বর্ণনা। সর্বদা সঠিক ও সর্বশেষ বিস্তারিত তথ্য অ্যাপের Firestore security rules-এ থাকে, এই ডকুমেন্টে নয় — দুটির মধ্যে অমিল দেখা দিলে, security rules-ই সঠিক ধরা হবে এবং এই ম্যানিফেস্টো তার সাথে মিলিয়ে আপডেট করা হবে।',
      },
      {
        heading: '৪. কিছু ভুল হলে — ব্রিচ রেসপন্স',
        list: [
          'কোনো টিম মেম্বার ডেটা লিক, ব্রিচ বা নিরাপত্তা সমস্যা খুঁজে পেলে সাথে সাথে Data & Systems Lead এবং Founder-কে জানান — কোনো বিলম্ব নয়',
          'সমস্যার পরিধি বোঝা মাত্রই প্রভাবিত শিক্ষার্থীদের সহজ ভাষায় জানানো হয় — কী ঘটেছে, কোন তথ্য জড়িত ছিল, KUETx এখন কী করছে',
          'সমস্যা ও এর সমাধান নথিভুক্ত করা হয়; এটি এই ম্যানিফেস্টোর গোপনীয়তা প্রতিশ্রুতিতে কোনো ফাঁক প্রকাশ করলে, তা পূরণের জন্য এই ডকুমেন্ট আপডেট করা হয়',
        ],
        footer: 'KUETx ফিচার যোগ করার সাথে সাথে (ক্লাউড সিঙ্ক, অ্যাকাউন্ট, নোটিফিকেশন), এই সেকশন আপডেট ও ব্যবহারকারীদের সাথে পুনরায় শেয়ার করা হবে — চুপচাপ পরিবর্তন করা হবে না।',
      },
      {
        heading: '৫. আচরণবিধি ও ব্যবহারের শর্তাবলী',
        body: 'KUETx-এর যেকোনো পদাধিকারী — Campus Lead থেকে Founder পর্যন্ত — নিম্নলিখিত বিষয়ে সম্মত হন, যা KUETx ব্যবহারকারী হিসেবে আপনার কাছ থেকেও প্রত্যাশিত:',
        subsections: [
          { subhead: 'সম্মান', list: [
            'ব্যাচ, বিভাগ বা জ্যেষ্ঠতা নির্বিশেষে প্রতিটি শিক্ষার্থী, সহকর্মী ও বিভাগীয় সংশ্লিষ্টকে সম্মানের সাথে আচরণ করা',
            'টিমের মধ্যে বা ব্যবহারকারীদের প্রতি কোনো ধরনের হয়রানি, বৈষম্য বা বর্জনমূলক আচরণ নয়',
          ]},
          { subhead: 'সততা', list: [
            'বাগ, ডেটা এরর ও ভুল সততার সাথে রিপোর্ট করা — সমস্যা লুকিয়ে রাখা সমস্যার চেয়েও খারাপ',
            'ব্যক্তিগত সুবিধার জন্য রুটিন, উপস্থিতি বা একাডেমিক তথ্য কখনো পরিবর্তন না করা',
          ]},
          { subhead: 'গোপনীয়তা', list: [
            'নিজ ভূমিকার মাধ্যমে অ্যাক্সেসকৃত শিক্ষার্থীর তথ্য শুধুমাত্র সেই ভূমিকার নির্ধারিত উদ্দেশ্যেই ব্যবহৃত হয়, অন্য কোথাও শেয়ার বা এক্সপোর্ট করা হয় না',
          ]},
        ],
      },
      {
        heading: '৬. মেধাস্বত্ব ও ওপেন-সোর্স অবস্থান',
        subsections: [
          { subhead: 'মালিকানা', body: 'KUETx-এর কোডবেস, ব্র্যান্ড ও ডিজাইন অ্যাসেট KUETx প্রজেক্টের পক্ষে Founder-এর মালিকানাধীন। কন্ট্রিবিউটররা (ইঞ্জিনিয়ার, ডিজাইনার, কনটেন্ট ক্রিয়েটর) তাদের কাজের জন্য কৃতিত্ব ধরে রাখেন কিন্তু প্রজেক্ট চালু থাকা পর্যন্ত ব্যবহারের অধিকার KUETx-কে দিয়ে দেন।' },
          { subhead: 'কন্ট্রিবিউটরদের অধিকার', list: [
            'উল্লেখযোগ্য কাজের জন্য প্রতিটি কন্ট্রিবিউটরকে নাম/পদবি সহ কৃতিত্ব দেওয়া হয়',
            'কন্ট্রিবিউটররা তাদের KUETx কাজ ব্যক্তিগত পোর্টফোলিও, রিজিউমে ও লিংকডইন প্রোফাইলে উল্লেখ করতে পারেন',
            'কোনো কন্ট্রিবিউটর KUETx-এর কোড বা কনটেন্ট নিয়ে আলাদা, প্রতিযোগী কোনো প্রোডাক্ট চালু করতে পারবেন না',
          ]},
          { subhead: 'ওপেন-সোর্স অবস্থান', body: 'KUETx আজ ওপেন-সোর্স নয়, মূলত এই প্রাথমিক পর্যায়ে একাডেমিক ডেটা লজিকের অখণ্ডতা রক্ষার জন্য। প্রজেক্ট পরিণত হওয়ার সাথে সাথে, নির্বাচিত অ-সংবেদনশীল কম্পোনেন্ট ওপেন-সোর্স করা হতে পারে।' },
        ],
      },
      {
        heading: '৭. স্পনসরশিপ, বিজ্ঞাপন ও তথ্যের ব্যবহার',
        body: 'রুটিন, উপস্থিতি, পরীক্ষার তথ্য ও প্রশ্নব্যাংক সবসময় পরিষ্কার ও বিজ্ঞাপনমুক্ত থাকে। স্পনসরশিপ ভিজিবিলিটি স্পষ্টভাবে আলাদা, অ-হস্তক্ষেপমূলক জায়গায় সীমাবদ্ধ।',
        subsections: [
          { subhead: 'কোনো স্পনসরের জন্যই KUETx যা করবে না', list: [
            'মূল একাডেমিক ফিচারে স্পনসর ব্র্যান্ডিং, বিজ্ঞাপন বা ট্র্যাকিং প্রবেশ করানো',
            'কোনো টায়ার বা চুক্তির অধীনে স্পনসরের কাছে শিক্ষার্থীর তথ্য শেয়ার বা বিক্রি করা',
            'অ্যাপ ফিচার, মডারেশন নীতি বা টিমের সিদ্ধান্তে স্পনসরকে কোনো প্রভাব দেওয়া',
            'শিক্ষার্থী দর্শকদের জন্য প্রতারণামূলক বা অনুপযুক্ত স্পনসর গ্রহণ করা (যেমন জুয়া, অনিয়ন্ত্রিত ঋণ)',
          ]},
        ],
      },
      {
        heading: '৮. ধারাবাহিকতা ও অ্যাপ বন্ধ হলে কী হবে',
        body: 'এই সেকশনটি নিশ্চিত করে যে KUETx-এর প্রতিশ্রুতি চুপচাপ হারিয়ে যাবে না।',
        subsections: [
          { subhead: 'KUETx বন্ধ করতে হলে', list: [
            'শিক্ষার্থীদের যুক্তিসঙ্গত আগাম নোটিশ দিয়ে জানানো হবে, হঠাৎ করে বন্ধ করা হবে না',
            'বন্ধ হওয়ার আগে শিক্ষার্থীরা নিজেদের তথ্য (রুটিন, উপস্থিতি রেকর্ড) এক্সপোর্ট করার সুযোগ পাবেন',
            'বন্ধ হওয়ার পরে কোনো ব্যবহারকারীর তথ্য সংরক্ষণ, বিক্রি বা পুনর্ব্যবহার করা হবে না — তা মুছে ফেলা হবে',
            'সোর্স কোড ও ডকুমেন্টেশন কোনো বিশ্বস্ত উত্তরসূরি টিম বা KUET বিভাগের কাছে হস্তান্তর করা হতে পারে',
          ]},
        ],
      },
      {
        heading: '৯. যোগাযোগ',
        body: 'এই নীতিমালা সংক্রান্ত কোনো প্রশ্ন থাকলে KUETx Founder-এর সাথে যোগাযোগ করুন। সম্পূর্ণ KUETx Manifesto app-এর About পেজ থেকে দেখা যাবে।',
      },
    ],
  },
  en: {
    pageTitle: 'Privacy Policy & Terms & Conditions',
    subtitle: 'KUETx — Student Life OS · Based on the KUETx Manifesto v1.1 (August 2026)',
    intro: "We believe privacy commitments shouldn't be hidden behind vague terms — this entire page is drawn directly from KUETx's public manifesto.",
    langToggleLabel: 'বাংলা',
    backLabel: 'Back',
    sections: [
      {
        heading: '1. What We Collect',
        list: [
          'Academic information students choose to enter: schedule, attendance records, batch/department',
          'Basic profile information needed to personalize the app experience',
          'For faculty: class, schedule, and verification information needed to run the faculty portal',
          'For service providers: business/contact information needed to list and operate on the Services marketplace',
        ],
      },
      {
        heading: '2. What KUETx Does Not Do',
        list: [
          'Sell or share student data with third parties, sponsors, or advertisers, under any circumstance',
          'Use student academic data for anything beyond the features it was entered for',
          'Insert sponsor content or tracking into core academic features (schedules, attendance, question banks)',
        ],
      },
      {
        heading: '3. Who Can Access Student Data',
        body: 'Data access is role-scoped and enforced at the database level (Firestore security rules), not just hidden in the UI:',
        list: [
          'Data & Systems Lead and Backend Engineer — full infrastructure access, for maintaining the app',
          "Admin / Head of Operations — can read a student's own profile document where needed for account administration",
          "Class group members (including CR/ACR) — can see group-level information for classes they belong to; a student's own profile document is otherwise private to that student",
          'Faculty — access scoped to the classes and data relevant to their role through the faculty portal',
          "Service providers — a provider's own contact number is only revealed to a student once that student has a confirmed (or completed) booking with that provider — not before",
        ],
        footer: "This section describes the current data-access model at a high level. The authoritative, up-to-date detail always lives in the app's Firestore security rules, not in this document — if the two ever appear to disagree, the security rules are correct and this manifesto should be updated to match.",
      },
      {
        heading: '4. If Something Goes Wrong — Breach Response',
        list: [
          'Any team member who discovers a data leak, breach, or security issue reports it immediately to the Data & Systems Lead and the Founder — no delay',
          'Affected students are notified as soon as the scope of the issue is understood, in plain language — what happened, what data was involved, what KUETx is doing about it',
          "The issue and its resolution are documented; if it reveals a gap in this manifesto's privacy commitments, this document is updated to close that gap",
        ],
        footer: 'As KUETx adds features (cloud sync, accounts, notifications), this section will be updated and re-shared with users — not silently changed.',
      },
      {
        heading: '5. Code of Conduct & Terms of Use',
        body: 'Every person holding a KUETx title — from Campus Lead to Founder — agrees to the following, which is also expected of you as a KUETx user:',
        subsections: [
          { subhead: 'Respect', list: [
            'Treat every student, teammate, and department contact with respect, regardless of batch, department, or seniority',
            'No harassment, discrimination, or exclusionary behavior of any kind within the team or toward users',
          ]},
          { subhead: 'Honesty', list: [
            'Report bugs, data errors, and mistakes honestly — covering up an issue is worse than the issue itself',
            'Never manipulate schedule, attendance, or academic data for personal advantage',
          ]},
          { subhead: 'Confidentiality', list: [
            "Student data accessed through your role is used only for that role's stated purpose, never shared or exported elsewhere",
          ]},
        ],
      },
      {
        heading: '6. Intellectual Property & Open-Source Stance',
        subsections: [
          { subhead: 'Ownership', body: 'The KUETx codebase, brand, and design assets are owned by the Founder on behalf of the KUETx project. Contributors (engineers, designers, content creators) retain credit for their work but assign usage rights to KUETx for as long as the project operates.' },
          { subhead: 'Contributor Rights', list: [
            'Every contributor is credited by name/title for significant work',
            'Contributors may reference their KUETx work in personal portfolios, resumes, and LinkedIn profiles',
            'No contributor may take KUETx code or content and launch a separate, competing product using it',
          ]},
          { subhead: 'Open-Source Stance', body: 'KUETx is not open-source today, primarily to protect the integrity of academic data logic during this early stage. As the project matures, select non-sensitive components may be open-sourced.' },
        ],
      },
      {
        heading: '7. Sponsorship, Ads & Data Use',
        body: 'Schedules, attendance, exam data, and question banks stay clean and ad-free. Sponsorship visibility is confined to clearly separate, non-intrusive spaces.',
        subsections: [
          { subhead: 'What KUETx Will Not Do for Any Sponsor', list: [
            'Insert sponsor branding, ads, or tracking inside core academic features',
            'Share or sell student data to a sponsor, under any tier or agreement',
            'Give a sponsor any influence over app features, moderation policy, or team decisions',
            'Accept sponsors whose product/service is predatory, deceptive, or inappropriate for a student audience (e.g. gambling, unregulated lending)',
          ]},
        ],
      },
      {
        heading: '8. Continuity & What Happens if KUETx Shuts Down',
        body: "This section exists so that KUETx's commitment doesn't quietly disappear.",
        subsections: [
          { subhead: 'If KUETx Must Shut Down', list: [
            'Students will be notified with reasonable advance notice, not abruptly cut off',
            'Students retain the ability to export their own data (schedule, attendance records) before shutdown',
            'No user data is retained, sold, or repurposed after shutdown — it is deleted',
            'Source code and documentation may be handed to a trusted successor team or KUET department, if one exists',
          ]},
        ],
      },
      {
        heading: '9. Contact',
        body: "For any questions about this policy, contact the KUETx Founder. The full KUETx Manifesto is available from the app's About page.",
      },
    ],
  },
};

function renderList(items) {
  return (
    <ul style={LIST_STYLE}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

// Body-only content, no page chrome (no full-screen wrapper, no back
// link) — reused by the full /privacy route below AND by the popup
// version RoleSelectScreen renders in a Modal, so the two never drift
// out of sync with separate copies of the same text.
export function PrivacyPolicyBody() {
  // Bangla by default — a plain toggle button, not a global app setting,
  // so this page's language is independent of Settings' provider-mode
  // language switch.
  const [lang, setLang] = useState('bn');
  const t = CONTENT[lang];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={22} color="var(--accent)" />
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{t.pageTitle}</div>
        </div>
        <button
          type="button"
          onClick={() => setLang(l => l === 'bn' ? 'en' : 'bn')}
          style={{
            flexShrink: 0, padding: '6px 11px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t.langToggleLabel}
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 28 }}>{t.subtitle}</div>

      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '20px 22px', marginBottom: 28,
        fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7,
      }}>
        {t.intro}
      </div>

      {t.sections.map((s, i) => (
        <div key={i} style={SECTION_STYLE}>
          <div style={HEADING_STYLE}>{s.heading}</div>
          {s.body && <div style={BODY_STYLE}>{s.body}</div>}
          {s.list && renderList(s.list)}
          {s.subsections && s.subsections.map((sub, j) => (
            <div key={j}>
              <div style={SUBHEAD_STYLE}>{sub.subhead}</div>
              {sub.body && <div style={BODY_STYLE}>{sub.body}</div>}
              {sub.list && renderList(sub.list)}
            </div>
          ))}
          {s.footer && <div style={{ ...BODY_STYLE, marginTop: 10 }}>{s.footer}</div>}
        </div>
      ))}
    </>
  );
}

// Full page — used by the standalone /privacy route (Navbar hamburger
// link, direct visits, sharing the URL). Not used by RoleSelectScreen's
// popup anymore; that renders PrivacyPolicyBody directly inside a Modal.
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

        <PrivacyPolicyBody />
      </div>
    </div>
  );
}
