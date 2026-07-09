import { useState } from 'react';
import StaffDashboardContent from './StaffDashboard';
import AdminEntryPoint from '../components/AdminEntryPoint';

/**
 * Single entry point for everyone with any kind of KUETx authority —
 * Head of Ops, Senior Campus Lead, Campus Lead, Content Lead, Growth,
 * Finance/Legal, and the Founder. Reached from one icon in the top
 * navbar (Navbar.jsx's quick-actions drawer), not buried in the big
 * hamburger/Sidebar nav list.
 *
 * Everyone's own staff-role sections render automatically (main session,
 * no extra login). The Founder's section additionally requires the
 * separate secure sign-in inside AdminEntryPoint — kept isolated on
 * purpose so it never collides with the visitor's regular session.
 */
export default function TeamDashboard() {
  const [activeTab, setActiveTab] = useState(null);

  return (
    <div className="team-dashboard-shell">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '12px 16px 32px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Team &amp; Administration</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          Everything here is scoped to whatever KUETx role(s) you actually hold.
        </p>

        <StaffDashboardContent onTabChange={setActiveTab} />

        {activeTab === 'founder' && (
          <div style={{ marginTop: 14 }}>
            <AdminEntryPoint />
          </div>
        )}
      </div>
    </div>
  );
}