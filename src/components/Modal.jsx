import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
    const node = document.createElement('div');
    portalNodeRef.current = node;
    document.body.appendChild(node);
    setMounted(true);

    return () => {
      if (portalNodeRef.current) {
        document.body.removeChild(portalNodeRef.current);
      }
    };
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
