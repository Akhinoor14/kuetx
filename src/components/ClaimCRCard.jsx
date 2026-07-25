import { useEffect, useState } from 'react';
import { waitForPendingWrites } from 'firebase/firestore';
import {
  requestCR, subscribeCRStatus, subscribeMyRole, subscribeOwnCRRequestStatus,
  subscribeOwnJoinRequestStatus, requestToJoinGroup,
  waitForOwnMembership, waitForOwnVerification, updateOwnMobile, MAX_CR,
  diagnosticCheckCRRequestsWrite, logCRRequestDiagnostics,
} from '../lib/groupSync';
import { checkCLVacant, applyForCampusLead } from '../lib/staffSync';
import { auth, db } from '../lib/firebase';
import PromptDialog from './PromptDialog';

/**
 * Shared logic behind both <ClaimCRCard> (full card) and
 * <ClaimCRInlineButton> (compact, mobile Personal-Info-adjacent variant).
 * Both render nothing until crStatus resolves, and nothing at all once the
 * user is confirmed CR/ACR — see the null-return checks in each component.
 */
function useClaimCRState(groupId, profile) {
  const [crStatus, setCrStatus] = useState(null);
  const [claimState, setClaimState] = useState('idle'); // idle | sending | sent | error
  const [claimMsg, setClaimMsg] = useState('');
  const [ownRole, setOwnRole] = useState(null);
  const [ownRequestStatus, setOwnRequestStatus] = useState(null);
  // CR/ACR mobile number is now mandatory (Faculty "All CR" page needs a
  // real contact number for every CR/ACR). Captured here inline so the
  // claim flow itself is the enforcement point — nobody can become CR
  // without ever having supplied one.
  const [mobile, setMobile] = useState('');

  const [ownJoinStatus, setOwnJoinStatus] = useState(null); // null | 'pending' | 'approved' | 'rejected' (derived below)

  useEffect(() => {
    if (!groupId) return;
    const unsubCrStatus = subscribeCRStatus(groupId, setCrStatus);
    const unsubRole = subscribeMyRole(groupId, auth.currentUser?.uid, setOwnRole);
    const unsubOwnRequest = subscribeOwnCRRequestStatus(groupId, auth.currentUser?.uid, setOwnRequestStatus);
    const unsubOwnJoin = subscribeOwnJoinRequestStatus(groupId, auth.currentUser?.uid, (req) => setOwnJoinStatus(req?.status || null));
    return () => { unsubCrStatus(); unsubRole(); unsubOwnRequest(); unsubOwnJoin(); };
  }, [groupId]);

  // Very light sanity check — not a strict Bangladeshi-number validator,
  // just enough to stop an empty/obviously-junk value (a single digit, a
  // stray letter) from being saved as someone's mandatory CR contact.
  const isMobileLikelyValid = (v) => /^[0-9+\-\s]{7,}$/.test(String(v || '').trim());

  const handleClaimCR = async (mobileOverride) => {
    const mobileToUse = mobileOverride !== undefined ? mobileOverride : mobile;
    if (crStatus?.slotsFull) {
      setClaimMsg('This class has no open CR slot. Retry after the CR steps down.');
      setClaimState('error');
      return;
    }
    if (!isMobileLikelyValid(mobileToUse)) {
      setClaimMsg('You need a valid mobile number to claim CR. Faculty will be able to see it.');
      setClaimState('error');
      return;
    }
    setClaimState('sending');
    try {
      const clVacant = await checkCLVacant(groupId);
      if (clVacant) {
        // Bootstrap path: no Campus Lead exists for this class yet, so
        // there's nobody who could have approved a plain join request
        // either. approveCLApplication's bundled-CR branch is explicitly
        // allowed (see firestore.rules members/create fallback comment)
        // to create the members/{uid} doc directly on approval — this is
        // the one legitimate way membership is ever granted without a
        // prior joinRequests approval, reserved for exactly this
        // no-authority-exists-yet situation.
        await applyForCampusLead(groupId, profile, { bundledCRClaim: true });
        setClaimMsg('No Campus Lead exists for your class yet, so your claim was sent as a combined Campus Lead + CR application to your department\'s Senior Campus Lead.');
        setClaimState('sent');
        return;
      }

      // A CR/ACR already exists for this class, so claiming CR requires
      // ALREADY being an approved member — no more auto-join-then-claim.
      // If not yet a member, send (or confirm) a join request and stop;
      // the person needs their CR/ACR to approve them into the class
      // first, then come back and claim CR as a normal verified member.
      const alreadyMember = await waitForOwnMembership(groupId, 1, 0);
      if (!alreadyMember) {
        await requestToJoinGroup(groupId, profile, String(profile?.kuetEmail || '').trim());
        setClaimMsg('You need to be an approved member of this class before claiming CR. We\'ve sent a join request to your class\'s CR/ACR — come back and claim CR once you\'re approved.');
        setClaimState('sent');
        return;
      }

      await updateOwnMobile(groupId, mobileToUse);
      await waitForPendingWrites(db);
      const verifiedReady = await waitForOwnVerification(groupId);
      if (!verifiedReady) throw new Error('Your class membership is still syncing. Try again in a moment.');
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
      setClaimState('sent');
    } catch (e) {
      const isPermissionDenied = e?.code === 'permission-denied' || /permission/i.test(e?.message || '');
      setClaimMsg(
        e?.message?.includes('pending CR request')
          ? 'You already have a pending CR request. Wait for your Campus Lead to act on it first.'
          : e?.message?.includes('pending join request')
            ? 'You already have a pending join request. Wait for your CR/ACR to approve it first.'
            : isPermissionDenied
              ? 'Permission denied. Try again in a moment — your verification may still be syncing.'
              : (e?.message || 'Something went wrong. Please try again.')
      );
      setClaimState('error');
    }
  };

  return { crStatus, claimState, claimMsg, ownRole, ownRequestStatus, ownJoinStatus, mobile, setMobile, handleClaimCR };
}

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
  const { crStatus, claimState, claimMsg, ownRole, ownRequestStatus, ownJoinStatus, mobile, setMobile, handleClaimCR } =
    useClaimCRState(groupId, profile);

  if (!groupId || !crStatus) return null;
  // ownRole starts as `null` until subscribeMyRole's first snapshot
  // arrives. Previously only the 'cr'/'acr' check below gated on it, so
  // a user who WAS already CR/ACR still rendered this full pitch card
  // for one frame (ownRole === null passes neither branch) before
  // vanishing once the real role came in — the flash reported here.
  // Treat "not yet known" the same as "don't render anything yet".
  if (ownRole === null) return null;
  if (ownRole === 'cr' || ownRole === 'acr') return null;

  if (ownJoinStatus === 'pending' && ownRequestStatus !== 'pending') {
    return (
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Join request pending</div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          You need to be an approved member of this class before claiming CR. Your join request is waiting on your class's CR/ACR — once approved, come back here to claim CR.
        </p>
      </div>
    );
  }

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
        {crStatus.slotsFull ? 'CR slot is full for your class' : 'CR slot open for your class'}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        {crStatus.slotsFull
          ? `The CR slot (max ${MAX_CR}) is currently filled. You'll be able to request once it opens up.`
          : 'Want to keep your class\'s routine and assignments up to date for everyone? Claim CR — it goes to your Campus Lead for approval (or becomes a combined application if there isn\'t one yet).'}
      </p>
      {!crStatus.slotsFull && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>
            Your mobile number (mandatory — Faculty will see this)
          </label>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="01XXXXXXXXX"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}
      <button
        className="btn btn-primary btn-sm"
        onClick={handleClaimCR}
        disabled={claimState === 'sending' || crStatus.slotsFull}
        title={
          crStatus.slotsFull
            ? `The CR slot (max ${MAX_CR}) is currently filled for this class`
            : undefined
        }
      >
        {claimState === 'sending' ? 'Sending…' : 'Claim CR'}
      </button>
      {crStatus.slotsFull && (
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
          The CR slot (max {MAX_CR}) is already filled — you can't request right now. Try again once it opens up.
        </div>
      )}
      {claimState === 'error' && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{claimMsg}</div>}
    </div>
  );
}

/**
 * Compact variant for placement next to Personal Info's "Edit" button
 * (mobile — see Profile.jsx). Shows only a slim text-button that mirrors
 * the same three states as the full card (open / pending / slots full),
 * without the pitch copy — the full <ClaimCRCard> further down still
 * carries the explanation and remains the primary surface on desktop.
 */
export function ClaimCRInlineButton({ groupId, profile }) {
  const { crStatus, claimState, ownRole, ownRequestStatus, ownJoinStatus, mobile, setMobile, handleClaimCR } =
    useClaimCRState(groupId, profile);
  // Compact variant has no room for an inline text field, so the
  // mandatory mobile number is collected via a small dialog that pops up
  // right before the actual claim submits — same enforcement as the full
  // card, just a different input surface.
  const [showMobileDialog, setShowMobileDialog] = useState(false);

  if (!groupId || !crStatus) return null;
  // Same reasoning as ClaimCRCard above: don't render until ownRole's
  // first snapshot has actually arrived.
  if (ownRole === null) return null;
  if (ownRole === 'cr' || ownRole === 'acr') return null;
  if (ownJoinStatus === 'pending' && ownRequestStatus !== 'pending') {
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, color: 'var(--muted)',
        padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        Join request pending
      </span>
    );
  }
  if (ownRequestStatus === 'pending' || claimState === 'sent') {
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, color: 'var(--muted)',
        padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        CR request pending
      </span>
    );
  }

  return (
    <>
    <button
      onClick={() => setShowMobileDialog(true)}
      disabled={claimState === 'sending' || crStatus.slotsFull}
      title={
        crStatus.slotsFull
          ? `The CR slot (max ${MAX_CR}) is currently filled for this class`
          : undefined
      }
      style={{
        padding: '6px 12px', background: 'var(--bg)', color: 'var(--accent)',
        border: '1px solid var(--border)', borderRadius: 8,
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        opacity: (claimState === 'sending' || crStatus.slotsFull) ? 0.6 : 1,
      }}
    >
      {claimState === 'sending' ? 'Sending…' : crStatus.slotsFull ? 'CR slot full' : 'Claim CR'}
    </button>
    <PromptDialog
      open={showMobileDialog}
      title="Mobile number (mandatory)"
      message="Enter a mobile number to claim CR. Faculty will be able to see it."
      defaultValue={mobile}
      placeholder="01XXXXXXXXX"
      confirmLabel="Continue"
      onCancel={() => setShowMobileDialog(false)}
      onConfirm={(value) => {
        setMobile(value);
        setShowMobileDialog(false);
        handleClaimCR(value);
      }}
    />
    </>
  );
}