import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { updateOwnMobile } from '../lib/groupSync';
import PromptDialog from './PromptDialog';

/**
 * Migration nudge for CR/ACRs who became CR BEFORE the mobile-number
 * requirement existed (see ClaimCRCard.jsx — new claims already enforce
 * this at request time, so this banner only ever fires for pre-existing
 * CR/ACR whose members/{uid}.mobile field is still empty/missing).
 *
 * Renders nothing for plain members, and nothing once a mobile number is
 * on file — this is a one-time catch-up prompt, not a permanent fixture.
 */
export default function CRMobileNumberBanner({ groupId, ownRole }) {
  const [mobileOnFile, setMobileOnFile] = useState(null); // null = unknown yet
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!groupId || !uid || (ownRole !== 'cr' && ownRole !== 'acr')) {
      setMobileOnFile(null);
      return;
    }
    const ref = doc(db, 'groups', groupId, 'members', uid);
    return onSnapshot(ref, (snap) => {
      setMobileOnFile(snap.exists() ? (snap.data().mobile || '') : '');
    }, () => setMobileOnFile(''));
  }, [groupId, ownRole]);

  if (ownRole !== 'cr' && ownRole !== 'acr') return null;
  if (mobileOnFile === null || mobileOnFile) return null; // still loading, or already has one

  return (
    <>
      <div className="card" style={{
        padding: 14, marginBottom: 16, border: '1px solid var(--warning, #f59e0b)',
        background: 'var(--warningBg, rgba(245,158,11,0.08))',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          Mobile number required
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          You are linked as {ownRole === 'cr' ? 'CR' : 'ACR'}, but you have not added a mobile number yet.
          Faculty can now see this number to contact CR/ACR members, so please add one.
        </p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowDialog(true)}>
          Add mobile number
        </button>
      </div>
      <PromptDialog
        open={showDialog}
        title="Your mobile number"
        message="Faculty in your class will be able to see this number."
        placeholder="01XXXXXXXXX"
        confirmLabel={saving ? 'Saving…' : 'Save'}
        onCancel={() => setShowDialog(false)}
        onConfirm={async (value) => {
          const trimmed = String(value || '').trim();
          if (!/^[0-9+\-\s]{7,}$/.test(trimmed)) return;
          setSaving(true);
          try {
            await updateOwnMobile(groupId, trimmed);
            setShowDialog(false);
          } catch (e) {
            console.error('[CRMobileNumberBanner] failed to save mobile', e);
          } finally {
            setSaving(false);
          }
        }}
      />
    </>
  );
}
