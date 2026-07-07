import { useEffect, useState } from 'react';
import { Users2 } from 'lucide-react';
import { getProfile } from '../store/store';
import { getGroupId, getGroupLabel } from '../lib/groupUtils';
import { joinGroup, requestCR, subscribeCRStatus, syncOwnVerification } from '../lib/groupSync';
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

  useEffect(() => {
    if (!groupId) return;
    joinGroup(groupId, profile).catch((e) => console.error('[Classmates] join failed', e));
    // Catch-up for people who verified their KUET email in an earlier
    // session/page and only later joined (or re-joined) this exact group
    // — joinGroup() never re-touches an existing member's verified flag,
    // and the 'kuetx:kuet-email-verified' event only fires at the moment
    // verification happens, so this mount-time check is what unsticks
    // anyone who was verified before this page ever saw it.
    syncOwnVerification(groupId, auth.currentUser?.uid).catch((e) => console.warn('[Classmates] syncOwnVerification failed', e));
    isRollInstitutionallyVerified(profile?.studentId).then(setOwnRollVerified).catch(() => setOwnRollVerified(false));
    return subscribeCRStatus(groupId, setCrStatus);
  }, [groupId]);

  const handleClaimCR = async () => {
    if (!ownRollVerified) {
      setClaimMsg('CR claim korar age nijer KUET email verify koro — upore "KUET email verify" box e roll bosao.');
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
    <div className="content-page-bg" style={{ maxWidth: 640, margin: '0 auto', padding: '16px 14px' }}>
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

      {groupId && crStatus && !crStatus.hasCR && claimState !== 'sent' && (
        <div className="card" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>No CR yet for your class</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Want to keep your class's routine and assignments up to date for everyone? Claim CR — it goes to
            your Campus Lead for approval (or becomes a combined application if there isn't one yet).
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleClaimCR}
            disabled={claimState === 'sending' || !ownRollVerified}
            title={!ownRollVerified ? 'KUET email verify korar por CR claim kora jabe' : undefined}
          >
            {claimState === 'sending' ? 'Sending…' : 'Claim CR'}
          </button>
          {!ownRollVerified && claimState !== 'error' && (
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
              CR claim korte hole age tomar KUET email verify korte hobe.
            </div>
          )}
          {claimState === 'error' && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{claimMsg}</div>}
        </div>
      )}
      {claimState === 'sent' && (
        <div className="card" style={{ padding: 14, marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>{claimMsg}</div>
      )}

      <ClassmatesList groupId={groupId} currentUid={auth.currentUser?.uid} />
    </div>
  );
}