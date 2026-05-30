// ── NavContextMenu ──────────────────────────────────────────────────────────────
// Long-press context menu for bottom nav tabs
// Shows: Pin/Hide/Replace/Usage reason

import { useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import { store } from '../../store/store';

export function NavContextMenu({
  isOpen,
  position,
  tabItem,
  usageCount,
  usageReason,
  onPin,
  onHide,
  onReplace,
  onClose,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen || !position || !tabItem) return null;

  const isPinned = (store.get('bottomnav_tabs_v2') || []).some(t => t.id === tabItem.id);
  const usageLabel = usageCount
    ? usageCount === 1
      ? 'Used 1x'
      : usageCount >= 7
      ? `Used ${usageCount}x/week`
      : `Used ${usageCount}x`
    : 'New';

  return (
    <div
      ref={menuRef}
      className="nav-context-menu"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
      role="menu"
    >
      {/* Header with item info */}
      <div className="nav-context-menu-header">
        <span className="nav-context-menu-title">{tabItem.label}</span>
        <span className="nav-context-menu-usage">{usageLabel}</span>
      </div>

      {usageReason && (
        <div className="nav-context-menu-reason">
          {usageReason}
        </div>
      )}

      {/* Divider */}
      <div className="nav-context-menu-divider" />

      {/* Actions */}
      <button
        className="nav-context-menu-action"
        onClick={() => {
          onPin();
          onClose();
        }}
        role="menuitem"
      >
        {isPinned ? (
          <>
            <Icons.PinOff size={14} />
            <span>Keep pinned</span>
          </>
        ) : (
          <>
            <Icons.Pin size={14} />
            <span>Pin it</span>
          </>
        )}
      </button>

      <button
        className="nav-context-menu-action nav-context-menu-action--danger"
        onClick={() => {
          onHide();
          onClose();
        }}
        role="menuitem"
      >
        <Icons.Eye size={14} strokeWidth={2.2} style={{ opacity: 0.6 }} />
        <span>Hide it</span>
      </button>

      <button
        className="nav-context-menu-action"
        onClick={() => {
          onReplace();
          onClose();
        }}
        role="menuitem"
      >
        <Icons.Shuffle size={14} />
        <span>Replace with...</span>
      </button>

      {/* Footer note */}
      <div className="nav-context-menu-footer">
        <Icons.Info size={12} />
        <span>{usageReason || 'Adaptive logic shows items based on usage'}</span>
      </div>
    </div>
  );
}
