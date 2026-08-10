import GuestBanner from './GuestBanner';
import GuestNav from './GuestNav';

// GUEST MODE (Phase 2) — shared shell for every /guest/* page: persistent
// banner (2.4) + minimal nav (2.5) + the page's own content. Kept
// separate from the real app's <Layout> (Sidebar/Navbar/Footer) entirely
// — different route tree, different shell, per Phase 2.1's "structurally
// impossible to leak guest mode into an authenticated session" goal.
export default function GuestShell({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GuestBanner />
      <GuestNav />
      <div style={{ flex: 1, padding: '1.25rem 1rem', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        {children}
      </div>
    </div>
  );
}
