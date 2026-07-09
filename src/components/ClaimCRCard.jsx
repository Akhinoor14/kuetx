import { useEffect, useState } from 'react';
import { waitForPendingWrites } from 'firebase/firestore';
import {
  joinGroup, requestCR, subscribeCRStatus, subscribeMyRole, subscribeOwnCRRequestStatus,
  syncOwnVerification, waitForOwnMembership, waitForOwnVerification, MAX_CR,
  diagnosticCheckCRRequestsWrite, logCRRequestDiagnostics,
} from '../lib/groupSync';
import { checkCLVacant, applyForCampusLead } from '../lib/staffSync';
import { isRollInstitutionallyVerified } from '../lib/kuetEmailVerify';
import { auth, db } from '../lib/firebase';

/**
 * Self-contained "Claim CR" card: shows the open-slot pitch + button when
 * the current user is a plain member with no pending request, a disabled
 * button with reason when slots are full, a "pending" state when they've
 * already got a request in flight, and renders nothing at all once they're
 * CR/ACR. All Firestore subscriptions/writes live here so any page can just
 * drop in <ClaimCRCard groupId={groupId} profile={profile} /> — this is the
 * same logic that used to live only in Classmates.jsx, now shared with
 * Profile.jsx and ProfileSetupModal.jsx so the entry point isn't hidden on
 * a single page.
 */
export default function ClaimCRCard({ groupId, profile }) {
  const [crStatus, setCrStatus] = useState(null);
  const [claimState, setClaimState] = useState('idle'); // idle | sending | sent | error
  const [claimMsg, setClaimMsg] = useState('');
  const [ownRollVerified, setOwnRollVerified] = useState(false);
  const [ownRole, setOwnRole] = useState(null);
  const [ownRequestStatus, setOwnRequestStatus] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    setOwnRollVerified(false);
    joinGroup(groupId, profile).catch((e) => console.error('[ClaimCRCard] join failed', e));
    syncOwnVerification(groupId, auth.currentUser?.uid)
      .catch((e) => console.warn('[ClaimCRCard] syncOwnVerification failed', e))
      .then(() => isRollInstitutionallyVerified(profile?.studentId))
      .then(setOwnRollVerified)
      .catch(() => setOwnRollVerified(false));
    const unsubCrStatus = subscribeCRStatus(groupId, setCrStatus);
    const unsubRole = subscribeMyRole(groupId, auth.currentUser?.uid, setOwnRole);
    const unsubOwnRequest = subscribeOwnCRRequestStatus(groupId, auth.currentUser?.uid, setOwnRequestStatus);
    return () => { unsubCrStatus(); unsubRole(); unsubOwnRequest(); };
  }, [groupId]);

  const handleClaimCR = async () => {
    if (!ownRollVerified) {
      setClaimMsg('KUET email verify করো। উপরে verify box দেখ।');
      setClaimState('error');
      return;
    }
    if (crStatus?.slotsFull) {
      setClaimMsg('এই ক্লাসের CR slots ভরে গেছে। কোনো CR step down করার পর retry করুন।');
      setClaimState('error');
      return;
    }
    setClaimState('sending');
    try {
      await joinGroup(groupId, profile);
      const membershipReady = await waitForOwnMembership(groupId);
      if (!membershipReady) throw new Error('Your class membership is still syncing. Try again in a moment.');
      await syncOwnVerification(groupId, auth.currentUser?.uid);
      await waitForPendingWrites(db);
      const verifiedReady = await waitForOwnVerification(groupId);
      if (!verifiedReady) throw new Error('Your class membership is still syncing. Try again in a moment.');
      const clVacant = await checkCLVacant(groupId);
      if (clVacant) {
        await applyForCampusLead(groupId, profile, { bundledCRClaim: true });
        setClaimMsg('No Campus Lead exists for your class yet, so your claim was sent as a combined Campus Lead + CR application to your department\'s Senior Campus Lead.');
      } else {
        try {
          await requestCR(groupId, profile);
        } catch (crError) {
          if (crError?.code === 'permission-denied' || /permission/i.test(crError?.message)) {
            const diagnos = await diagnosticCheckCRRequestsWrite(groupId, profile);
            logCRRequestDiagnostics(groupId, profile, diagnos);
          }
          throw crError;
        }
        setClaimMsg('Your request was sent to your class\'s Campus Lead for approval.');
      }
      setClaimState('sent');
    } catch (e) {
      const isPermissionDenied = e?.code === 'permission-denied' || /permission/i.test(e?.message || '');
      setClaimMsg(
        e?.message?.includes('pending CR request')
          ? 'You already have a pending CR request. Wait for your Campus Lead to act on it first.'
          : isPermissionDenied
            ? 'Permission denied. Try again in a moment — your verification may still be syncing.'
            : (e?.message || 'Something went wrong. Please try again.')
      );
      setClaimState('error');
    }
  };

  if (!groupId || !crStatus) return null;
  if (ownRole === 'cr' || ownRole === 'acr') return null;

  if (ownRequestStatus === 'pending' || claimState === 'sent') {
    return (
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>CR request pending</div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Your request is waiting on your Campus Lead for approval. You'll see it reflected here once they act on it.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {crStatus.slotsFull ? 'CR slots are full for your class' : 'CR slot open for your class'}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        {crStatus.slotsFull
          ? `Both CR slots (max ${MAX_CR}) are currently filled. You'll be able to request once a slot opens up.`
          : 'Want to keep your class\'s routine and assignments up to date for everyone? Claim CR — it goes to your Campus Lead for approval (or becomes a combined application if there isn\'t one yet).'}
      </p>
      <button
        className="btn btn-primary btn-sm"
        onClick={handleClaimCR}
        disabled={claimState === 'sending' || !ownRollVerified || crStatus.slotsFull}
        title={
          crStatus.slotsFull
            ? `Both CR slots (max ${MAX_CR}) are currently filled for this class`
            : !ownRollVerified
              ? 'Verify your KUET email before you can claim CR'
              : undefined
        }
      >
        {claimState === 'sending' ? 'Sending…' : 'Claim CR'}
      </button>
      {!ownRollVerified && claimState !== 'error' && (
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
          You need to verify your KUET email before claiming CR.
        </div>
      )}
      {ownRollVerified && crStatus.slotsFull && (
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
          Both CR slots (max {MAX_CR}) are already filled — you can't request right now. Try again once a slot opens up.
        </div>
      )}
      {claimState === 'error' && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{claimMsg}</div>}
    </div>
  );
}
