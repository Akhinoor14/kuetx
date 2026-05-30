import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';

export default function SettingsNavGuide() {
  return (
    <div className="page-enter page-container">
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>Bottom Navigation — Full Guide</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Detailed instructions for customizing tabs, groups, and presets.</p>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Overview</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          The Bottom Navigation shows your most-used pages for quick access. Use the <strong>All Pages</strong> drawer
          (swipe up on mobile or tap "Pages") to pin pages or an entire section as a single tab. You can keep up to
          four pinned tabs (plus the Dashboard).
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Quick Actions in the Drawer</div>
        <ul style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
          <li><strong>Pin a page:</strong> Tap the pin button next to a page to add it to your tabs.</li>
          <li><strong>Pin a group:</strong> Tap a group's header to pin the whole group as a single tab.</li>
          <li><strong>Create a custom group:</strong> In the drawer, start a new group, add pages, then save.</li>
          <li><strong>Edit or Delete:</strong> Long-press a custom group to rename or remove it.</li>
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Presets & Context</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          The app can suggest or auto-apply presets based on your academic calendar (exam weeks, term starts, etc.).
          Enable context-aware suggestions in Navigation Settings to receive recommendations.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Tips & Recovery</div>
        <ul style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
          <li>Use Reset to restore recommended default tabs and groups.</li>
          <li>Back up your data from Settings → Backup & Restore to keep your custom groups across devices.</li>
          <li>If something looks wrong, open Settings → Navigation and use Reset or edit groups directly.</li>
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Link to="/settings/navigation" className="btn btn-ghost">Back to Navigation Settings</Link>
      </div>
    </div>
  );
}
