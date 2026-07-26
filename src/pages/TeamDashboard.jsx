import { Users } from 'lucide-react';
import StaffDashboardContent from './StaffDashboard';
import AdminEntryPoint from '../components/AdminEntryPoint';
import { useUrlTabState } from '../hooks/useUrlTabState';

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
  // BUGFIX (back-button skips whole page): activeTab used to be plain
  // useState, so switching role-tabs (e.g. Founder <-> Head of Ops) never
  // touched browser history. Pressing Back from inside the Founder tab
  // therefore didn't step back to the tab list — it left /team entirely,
  // straight to whatever page was visited before /team. Mirroring
  // activeTab into the ?tab= URL param means each tab switch is a real
  // history entry, so Back walks out one tab at a time, and a direct link
  // to a specific tab (e.g. /team?tab=founder) works too.
  const [activeTab, setActiveTab] = useUrlTabState('tab', null);

  return (
    <div className="page-enter team-dashboard-shell content-page-bg">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '12px 16px 32px' }}>
        <div className="content-page-hero">
          <div className="content-page-hero-main">
            <div className="content-page-hero-head">
              <div className="content-page-hero-icon">
                <Users size={24} color="var(--accent)" />
              </div>
              <h1 className="content-page-hero-title">Team & Administration</h1>
            </div>
            <p className="content-page-hero-subtitle">Everything here is scoped to whatever KUETx role(s) you actually hold.</p>
          </div>
        </div>

        <StaffDashboardContent activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'founder' && (
          <div style={{ marginTop: 14 }}>
            <AdminEntryPoint />
          </div>
        )}
      </div>
    </div>
  );
}