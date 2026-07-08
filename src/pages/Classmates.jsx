import { useEffect, useState } from 'react';
import { Users2 } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { joinGroup, requestCR, subscribeCRStatus, subscribeMembers, syncOwnVerification, waitForOwnMembership, waitForOwnVerification, MAX_CR } from '../lib/groupSync';
import { checkCLVacant, applyForCampusLead } from '../lib/staffSync';
import { isRollInstitutionallyVerified } from '../lib/kuetEmailVerify';
import { auth } from '../lib/firebase';
import ClassmatesList from '../components/ClassmatesList';
import KuetEmailVerifyBox from '../components/KuetEmailVerifyBox';

export default function Classmates() {
  const profile = getProfile();
  const groupId = getGroupId(profile);
  const groupLabel = getGroupLabel(profile);
  const [crStatus, setCrStatus] = useState(null);
  const [claimState, setClaimState] = useState('idle'); // idle | sending | sent | error
  const [claimMsg, setClaimMsg] = useState('');
  // Tracks whether THIS user's own roll has a Tier-1 institutional
  // verification on record. Gates the "Claim CR" button client-side —
  // Firestore rules already reject an unverified claim server-side
  // (isVerifiedMember/rollIsInstitutionallyVerified on crRequests/
  // clApplications create), but without this the button was shown to
  // everyone and an unverified click just died as a silent
  // permission-denied with no useful message.
  const [ownRollVerified, setOwnRollVerified] = useState(false);
  // Gates ClassmatesList from mounting its members subscription before this
  // user's own membership doc exists. Firestore rules require an existing
  // members/{uid} doc to read the members collection at all (isGroupMember),
  // so subscribing in the same tick as joinGroup() raced a permission-denied
  // on every first-ever visit (self-healed after a few seconds via retry,
  // but showed a misleading empty "no classmates" list in the meantime).
  const [joined, setJoined] = useState(false);
  // The current user's own role in this group (from the live members
  // subscription, never self-reported) — gates the "Claim CR" card below.
  // crStatus only tracks slot occupancy (0/2, 1/2, full), not who holds
  // those slots, so without this a CR/ACR was shown "Claim CR" for their
  // own already-filled slot instead of the card just disappearing.
  const [ownRole, setOwnRole] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    setJoined(false);
    setOwnRollVerified(false);
    joinGroup(groupId, profile)
      .then(() => waitForOwnMembership(groupId))
      .then(() => setJoined(true))
      .catch((e) => { console.error('[Classmates] join failed', e); setJoined(true); });
    // Catch-up for people who verified their KUET email in an earlier
    // session/page and only later joined (or re-joined) this exact group
    // -- joinGroup() never re-touches an existing member's verified flag,
    // and the 'kuetx:kuet-email-verified' event only fires at the moment
    // verification happens, so this mount-time check is what unsticks
    // anyone who was verified before this page ever saw it.
    //
    // IMPORTANT: this must resolve (and its Firestore write, if any, must
    // actually land) BEFORE the "Claim CR" button can be enabled. The
    // green "KUET email verified" banner reflects a *global*, roll-level
    // fact (verifiedRolls/{roll} exists) — but the security rule that
    // gates the crRequests write checks THIS group's own
    // members/{uid}.verified field specifically, which is a separate
    // write that syncOwnVerification() itself has to perform and which
    // takes a moment to propagate server-side. Setting ownRollVerified
    // from isRollInstitutionallyVerified() alone (as before) let the
    // button go green and clickable before that group-doc write had
    // actually landed, so a fast click raced ahead of it and got rejected
    // with "Missing or insufficient permissions" even though the account
    // really was verified moments later.
    syncOwnVerification(groupId, auth.currentUser?.uid)
      .catch((e) => console.warn('[Classmates] syncOwnVerification failed', e))
      .then(() => isRollInstitutionallyVerified(profile?.studentId))
      .then(setOwnRollVerified)
      .catch(() => setOwnRollVerified(false));
    const unsubCrStatus = subscribeCRStatus(groupId, setCrStatus);
    const unsubMembers = subscribeMembers(groupId, (members) => {
      const me = members.find((m) => m.id === auth.currentUser?.uid);
      setOwnRole(me?.role || null);
    });
    return () => { unsubCrStatus(); unsubMembers(); };
  }, [groupId]);

  const handleClaimCR = async () => {
    if (!ownRollVerified) {
      setClaimMsg('Verify your KUET email before claiming CR — enter your roll in the "KUET email verify" box above.');
      setClaimState('error');
      return;
    }
    setClaimState('sending');
    try {
      // Guard against the rare race where this page's mount-time joinGroup()
      // write is still in flight (or failed) when the user clicks Claim CR —
      // applyForCampusLead()'s Tier-1 path doesn't strictly need the member
      // doc, but a bundled CR approval later does, so make sure it exists
      // before proceeding.
      await joinGroup(groupId, profile);
      // Belt-and-suspenders: re-sync this group's own members/{uid}.verified
      // field right before the write that actually needs it. The mount-time
      // effect already does this, but a user who clicks fast enough (or
      // whose mount-time sync failed transiently) could otherwise still hit
      // the exact same "Missing or insufficient permissions" race this was
      // written to close.
      await syncOwnVerification(groupId, auth.currentUser?.uid);
      await waitForOwnVerification(groupId);
      const clVacant = await checkCLVacant(groupId);
      if (clVacant) {
        // No Campus Lead yet for this dept+batch — bundle the CR claim
        // into a Campus Lead application, routed to that department's
        // Senior Campus Lead (or Head of Ops/Founder if that's vacant too).
        await applyForCampusLead(groupId, profile, { bundledCRClaim: true });
        setClaimMsg('No Campus Lead exists for your class yet, so your claim was sent as a combined Campus Lead + CR application to your department\'s Senior Campus Lead.');
      } else {
        await requestCR(groupId, profile);
        setClaimMsg('Your request was sent to your class\'s Campus Lead for approval.');
      }
      setClaimState('sent');
    } catch (e) {
      console.error('[Classmates] claim CR failed', e);
      setClaimMsg(e?.message || 'Something went wrong — try again.');
      setClaimState('error');
    }
  };

  return (
    <div className="page-enter content-page-bg" style={{ maxWidth: 640, margin: '0 auto', padding: '16px 14px' }}>
      <div className="content-page-hero">
        <div className="content-page-hero-icon">
          <Users2 size={18} color="var(--accent)" />
        </div>
        <h1 className="content-page-hero-title">Classmates</h1>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        {groupId
          ? <>Everyone from your class — <strong>{groupLabel}</strong> — who has joined KUETx.</>
          : 'Add your department and batch in Profile to find your classmates.'}
      </p>

      {groupId && <KuetEmailVerifyBox />}

      {groupId && crStatus && claimState !== 'sent' && ownRole !== 'cr' && ownRole !== 'acr' && (
        <div className="card" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            {crStatus.slotsFull ? 'CR slots are full for your class' : 'CR slot open for your class'}
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            {crStatus.slotsFull
              ? `Both CR slots (max ${MAX_CR}) are currently filled. You can still apply — your request queues and your Campus Lead can approve it the moment a slot opens up.`
              : 'Want to keep your class\'s routine and assignments up to date for everyone? Claim CR — it goes to your Campus Lead for approval (or becomes a combined application if there isn\'t one yet).'}
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleClaimCR}
            disabled={claimState === 'sending' || !ownRollVerified}
            title={!ownRollVerified ? 'Verify your KUET email before you can claim CR' : undefined}
          >
            {claimState === 'sending' ? 'Sending…' : 'Claim CR'}
          </button>
          {!ownRollVerified && claimState !== 'error' && (
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
              You need to verify your KUET email before claiming CR.
            </div>
          )}
          {claimState === 'error' && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{claimMsg}</div>}
        </div>
      )}
      {claimState === 'sent' && (
        <div className="card" style={{ padding: 14, marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>{claimMsg}</div>
      )}

      {joined
        ? <ClassmatesList groupId={groupId} currentUid={auth.currentUser?.uid} />
        : <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Loading classmates...</div>}
    </div>
  );
}
