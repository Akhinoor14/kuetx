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
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 14px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Team &amp; Administration</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
        Everything here is scoped to whatever KUETx role(s) you actually hold.
      </p>

      <StaffDashboardContent />

      <div style={{ marginTop: 20 }}>
        <AdminEntryPoint />
      </div>
    </div>
  );
}
