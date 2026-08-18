// TeacherClaimBanner.jsx — §8.7 of the merged Faculty Module prompt
//
// Standalone banner, NOT wired into Schedule.jsx's own render tree beyond
// a single mount call (see facultyDisambiguation.js's header for the full
// corrected reasoning). Dropped onto Schedule.jsx via one import + one
// render call, the same "additive, not invasive" pattern used throughout
// this module (e.g. TeacherVerifiedCard.jsx on Marks.jsx).
//
// PHASE 3 (CR_TEACHER_LINKING_NOTES.md): this used to be read-only — it
// showed a match (from facultyDisambiguation.js) and "dismiss" only
// hid it in localStorage, no real link was ever written anywhere. Now
// "Invite this teacher" writes a real groups/{groupId}/teacherLinkRequests
// doc (see that file's header for why this reuses the existing name-match
// instead of the originally-planned separate email-anchor system) — the
// teacher gets a real pending request they can accept/decline, not just a
// silently-ignored suggestion. Dismissing still only hides the banner
// locally and changes nothing server-side — declining/never-inviting
// leaves the free-text teacherName working exactly as before, matching
// this module's "convenience, not a gate" principle throughout.
//
// UX pattern still mirrors ClaimCRCard.jsx per §8.7's own instruction:
// shows nothing until a match resolves, offers a lightweight choice, and
// not acting on it leaves everything exactly as it was.
//
// PHASE 4 (CR_TEACHER_LINKING_NOTES.md): two additions on top of Phase 3's
// shape above, both described in full where they're implemented below —
// (1) this banner now also renders pending teacher_to_cr proposals (a
// teacher proposed linking FROM their own class, see FacultyClassDetail
// .jsx's mirror card) with its own Accept/Decline, not just the
// cr_to_teacher matches this file originally showed; (2) the passive
// name-match suggestions (matches/visibleMatches below) now also filter
// out any entryId that was already declined once (teacherLinkRequests
// .js's wasDeclinedFor) — resolving §6's decline-policy decision point as
// "manual only": no more auto-resurfacing, but the explicit "Invite this
// teacher" action is never blocked by a past decline.

import { useEffect, useMemo, useState } from 'react';
import { Link2, X, Check, Clock } from 'lucide-react';
import { subscribeRoutine } from '../lib/groupSync';
import { findMatchingFacultyForSchedule } from '../lib/facultyDisambiguation';
import { createInviteFromCr, subscribePendingLinkRequests, applyLinkAfterAccept, acceptRequest, declineRequest, wasDeclinedFor } from '../lib/teacherLinkRequests';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notify } from '../lib/notify';

const DISMISSED_KEY_PREFIX = 'kuetx_teacherClaimDismissed_';

export default function TeacherClaimBanner({ groupId, profile, canEdit }) {
  const [matches, setMatches] = useState(new Map());
  const [pendingRequests, setPendingRequests] = useState([]);
  const [inviting, setInviting] = useState(null); // entryId currently being invited
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY_PREFIX + groupId);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (!groupId || !canEdit) return;
    return subscribeRoutine(groupId, (entries) => {
      findMatchingFacultyForSchedule(groupId, entries || []).then(setMatches);
    });
  }, [groupId, canEdit]);

  // PHASE 4 (§6's decline policy, resolved as "manual only"): once a
  // cr_to_teacher pairing for a given entryId has been declined, stop
  // auto-suggesting it in this passive banner — but leave the explicit
  // manual re-invite path (see facultyDisambiguation.js's own note on
  // TeacherClaimBanner, and this component's "Invite this teacher"
  // button) fully unaffected; this only ever filters what's shown here,
  // it never blocks a write. entryIds already in `matches` are checked
  // one by one (small set in practice — one per teacherName on the
  // grid), not batched, since teacherLinkRequests.js only exposes a
  // per-entry check.
  const [declinedEntryIds, setDeclinedEntryIds] = useState(new Set());
  useEffect(() => {
    if (!groupId || !canEdit || matches.size === 0) { setDeclinedEntryIds(new Set()); return; }
    let cancelled = false;
    Promise.all(
      [...matches.keys()].map((entryId) =>
        wasDeclinedFor(groupId, entryId, 'cr_to_teacher').then((declined) => [entryId, declined])
      )
    ).then((results) => {
      if (cancelled) return;
      setDeclinedEntryIds(new Set(results.filter(([, declined]) => declined).map(([entryId]) => entryId)));
    }).catch((e) => {
      console.warn('[TeacherClaimBanner] wasDeclinedFor check failed:', e);
    });
    return () => { cancelled = true; };
  }, [groupId, canEdit, matches]);

  useEffect(() => {
    if (!groupId || !canEdit) return;
    return subscribePendingLinkRequests(groupId, setPendingRequests, () => setPendingRequests([]));
  }, [groupId, canEdit]);

  // PHASE 3: a cr_to_teacher request this CR sent just got accepted by
  // the faculty account (see FacultyClassDetail.jsx's Accept button,
  // which only flips the request's own status — it can't write
  // routineEntries itself, see teacherLinkRequests.js's
  // applyLinkAfterAccept doc comment for why). This is the other half:
  // whichever CR/ACR client happens to be subscribed notices the
  // 'accepted' status and performs the actual routineEntries write, which
  // firestore.rules only lets a CR/ACR/CL/Admin do. Runs once per request
  // (appliedLinkIds guards against re-firing on every snapshot).
  const [appliedLinkIds, setAppliedLinkIds] = useState(() => new Set());
  useEffect(() => {
    if (!groupId || !canEdit) return undefined;
    const q = query(
      collection(db, 'groups', groupId, 'teacherLinkRequests'),
      where('direction', '==', 'cr_to_teacher'),
      where('status', '==', 'accepted'),
    );
    const unsub = onSnapshot(q, (snap) => {
      snap.docs.forEach((d) => {
        const r = d.data();
        if (appliedLinkIds.has(d.id)) return;
        setAppliedLinkIds((prev) => new Set(prev).add(d.id));
        applyLinkAfterAccept(groupId, profile, {
          entryId: r.entryId,
          linkedFacultyUid: r.targetFacultyUid,
          linkedAssignmentId: r.assignmentId,
        }).then(() => {
          notify('Teacher linked — verified attendance/marks will now show up on the grid.', 'success');
        }).catch((e) => {
          console.warn('[TeacherClaimBanner] applyLinkAfterAccept failed:', e);
        });
      });
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- appliedLinkIds intentionally omitted: including it would re-subscribe on every accept, and the guard inside the callback (not the effect dependency) is what prevents double-application.
  }, [groupId, profile, canEdit]);

  // entryId -> pending cr_to_teacher request already sent for it, so the
  // button can switch to a "waiting for accept" state instead of letting
  // a CR fire off duplicate invites for the same entry/teacher.
  const pendingByEntryId = useMemo(() => {
    const map = new Map();
    for (const r of pendingRequests) {
      if (r.direction === 'cr_to_teacher') map.set(r.entryId, r);
    }
    return map;
  }, [pendingRequests]);

  // PHASE 3 reverse direction: pending teacher_to_cr proposals, where a
  // teacher (via FacultyClassDetail.jsx's own match against this exact
  // group's routineEntries) proposed linking their own assignment to one
  // of this CR's grid entries. Any CR/ACR of the group can accept (first
  // to act wins — mirrored by firestore.rules' status guard), same
  // "no app-wide notification system yet, this live subscription IS the
  // notification" situation as everywhere else in this feature.
  const pendingProposals = useMemo(
    () => pendingRequests.filter((r) => r.direction === 'teacher_to_cr'),
    [pendingRequests],
  );
  const [resolvingProposal, setResolvingProposal] = useState(null); // requestId mid-action, or null

  const acceptProposal = async (r) => {
    if (resolvingProposal) return;
    setResolvingProposal(r.id);
    try {
      await acceptRequest(groupId, r.id);
      await applyLinkAfterAccept(groupId, profile, {
        entryId: r.entryId,
        linkedFacultyUid: r.initiatedBy,
        linkedAssignmentId: r.assignmentId,
      });
      notify('Teacher linked — verified attendance/marks will now show up on the grid.', 'success');
    } catch (e) {
      console.warn('[TeacherClaimBanner] acceptProposal failed:', e);
      notify('Could not accept this proposal. Please try again.', 'error');
    } finally {
      setResolvingProposal(null);
    }
  };

  const declineProposal = async (r) => {
    if (resolvingProposal) return;
    setResolvingProposal(r.id);
    try {
      await declineRequest(groupId, r.id);
    } catch (e) {
      console.warn('[TeacherClaimBanner] declineProposal failed:', e);
      notify('Could not decline this proposal. Please try again.', 'error');
    } finally {
      setResolvingProposal(null);
    }
  };

  const dismiss = (entryId) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(entryId);
      try { localStorage.setItem(DISMISSED_KEY_PREFIX + groupId, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const invite = async (entryId, assignment) => {
    if (inviting) return;
    const targetFacultyUid = assignment.teacherUids?.[0];
    if (!targetFacultyUid) {
      notify('Could not determine the teacher account to invite.', 'error');
      return;
    }
    setInviting(entryId);
    try {
      await createInviteFromCr(groupId, profile, {
        entryId,
        teacherName: assignment.gridAlias || assignment.displayName || '',
        targetFacultyUid,
        assignmentId: assignment.assignmentId,
        courseCode: assignment.courseCode,
      });
      notify('Invite sent — the teacher will need to accept it.', 'success');
    } catch (e) {
      console.warn('[TeacherClaimBanner] invite failed:', e);
      notify('Could not send the invite. Please try again.', 'error');
    } finally {
      setInviting(null);
    }
  };

  const visibleMatches = [...matches.entries()].filter(([entryId]) => !dismissedIds.has(entryId) && !declinedEntryIds.has(entryId));
  if (!canEdit || (visibleMatches.length === 0 && pendingProposals.length === 0)) return null;

  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
      {pendingProposals.map((r) => (
        <div key={r.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
          padding: '10px 12px', borderRadius: 10,
          background: 'color-mix(in srgb, var(--accent) 8%, var(--card))',
          border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)' }}>
            <Link2 size={14} color="var(--accent)" />
            <span>
              A verified teacher{r.courseCode ? ` for ${r.courseCode}` : ''} wants to link their class to this grid entry. Their own class time/schedule stays exactly as they've set it.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => acceptProposal(r)}
              disabled={resolvingProposal === r.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                background: 'var(--accent)', color: 'var(--accent-contrast, #fff)',
                border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                opacity: resolvingProposal === r.id ? 0.6 : 1,
              }}
            >
              <Check size={13} /> Accept
            </button>
            <button
              onClick={() => declineProposal(r)}
              disabled={resolvingProposal === r.id}
              style={{
                fontSize: 12, fontWeight: 600, color: 'var(--muted)',
                background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                opacity: resolvingProposal === r.id ? 0.6 : 1,
              }}
            >
              Decline
            </button>
          </div>
        </div>
      ))}
      {visibleMatches.map(([entryId, assignment]) => {
        const pending = pendingByEntryId.get(entryId);
        return (
          <div key={entryId} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
            padding: '10px 12px', borderRadius: 10,
            background: 'color-mix(in srgb, var(--accent) 8%, var(--card))',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)' }}>
              <Link2 size={14} color="var(--accent)" />
              <span>
                <strong>{assignment.gridAlias || assignment.displayName}</strong> matches a verified faculty account for {assignment.courseCode}
                {pending ? ' — invite sent, waiting for them to accept.' : '. Link them so attendance/marks show up automatically?'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {pending ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
                  <Clock size={13} /> Pending
                </span>
              ) : (
                <button
                  onClick={() => invite(entryId, assignment)}
                  disabled={inviting === entryId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                    background: 'var(--accent)', color: 'var(--accent-contrast, #fff)',
                    border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                    opacity: inviting === entryId ? 0.6 : 1,
                  }}
                >
                  <Check size={13} /> {inviting === entryId ? 'Inviting…' : 'Invite this teacher'}
                </button>
              )}
              <button
                onClick={() => dismiss(entryId)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
