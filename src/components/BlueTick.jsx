import * as Icons from 'lucide-react';

/**
 * Facebook/X-style blue verification tick. This is the ONE badge for
 * "this person's KUET identity is confirmed" — whether that confirmation
 * came from Tier 1 (automatic @stud.kuet.ac.bd email proof) or Tier 2
 * (manual CL/CR approval), the visitor doesn't need to know which; both
 * mean the same thing: this really is who they say they are.
 *
 * size: pixel size of the icon. title: tooltip text.
 */
export default function BlueTick({ size = 14, title = 'Verified KUET student' }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size + 2, height: size + 2, borderRadius: '50%',
        background: '#1d9bf0', flexShrink: 0, lineHeight: 0,
      }}
    >
      <Icons.Check size={size - 4} color="white" strokeWidth={3.5} />
    </span>
  );
}
