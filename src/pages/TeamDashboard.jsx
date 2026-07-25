import { useState } from 'react';
import { Users } from 'lucide-react';
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
    <div className="page-enter team-dashboard-shell content-page-bg">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '12px 16px 32px' }}>
        <div className="content-page-hero" style={{ marginBottom: 16 }}>
          <div className="content-page-hero-icon">
            <Users size={18} color="var(--accent)" />
          </div>
          <div>
            <h1 className="content-page-hero-title">Team & Administration</h1>
            <p className="content-page-hero-subtitle">Everything here is scoped to whatever KUETx role(s) you actually hold.</p>
          </div>
        </div>

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