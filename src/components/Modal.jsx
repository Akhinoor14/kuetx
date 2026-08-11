import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Single shared portal root, created lazily once and reused by every Modal
// instance for the lifetime of the page. Previously each Modal mount created
// a brand-new DOM node with document.createElement + appendChild and tore it
// down with removeChild on unmount — small overhead per open/close, but it
// adds up with how often modals get opened/closed. Reusing one root avoids
// that DOM churn; React still fully mounts/unmounts each Modal's own subtree
// inside it via createPortal, so there's no behavior change, just no need to
// touch document.body itself each time.
let sharedPortalRoot = null;
function getPortalRoot() {
  if (!sharedPortalRoot) {
    sharedPortalRoot = document.createElement('div');
    sharedPortalRoot.setAttribute('id', 'modal-portal-root');
    document.body.appendChild(sharedPortalRoot);
  }
  return sharedPortalRoot;
}

export default function Modal({
  children,
  onClose,
  overlayStyle = {},
  contentStyle = {},
  className,
  contentClassName,
  closeOnOverlayClick = true,
  overlayProps = {},
  contentProps = {},
}) {
  const [mounted, setMounted] = useState(false);
  const portalNodeRef = useRef(null);

  useEffect(() => {
    portalNodeRef.current = getPortalRoot();
    setMounted(true);
  }, []);

  if (!mounted || !portalNodeRef.current) {
    return null;
  }

  return createPortal(
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: 12,
        pointerEvents: 'auto',
        ...overlayStyle,
      }}
      onClick={closeOnOverlayClick ? onClose : undefined}
      {...overlayProps}
    >
      <div
        className={contentClassName}
        style={{ pointerEvents: 'auto', ...contentStyle }}
        onClick={(e) => e.stopPropagation()}
        {...contentProps}
      >
        {children}
      </div>
    </div>,
    portalNodeRef.current,
  );
}
