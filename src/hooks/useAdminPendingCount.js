// useAdminPendingCount.js
//
// Single shared "how many things need my attention right now" number for
// whoever holds a staff role — Founder or Campus Lead. This is the count
// that shows up as a badge OUTSIDE the Team & Administration page itself:
// on the Sidebar's hub row and on the AdminHub (bottom-nav) entry. Until
// this hook existed, every one of these pending counts only became
// visible after clicking into /team and then into a specific card/tab —
// see AdminDashboard.jsx's `countCtx` / founderCategories.js's `getCount`
// registry, which already computes the exact same numbers for the
// in-page badges. This hook is the "outside the page" mirror of that,
// reusing the same underlying subscriptions rather than duplicating the
// counting logic in two places.
//
// Scope:
//   - Founder: total across every approval-bearing category (CL apps, CR
//     requests, CR leave requests, student manual-verification, QB
//     uploads, provider verification, account-deletion requests,
//     community-submitted publications, faculty signup requests). This
//     mirrors FOUNDER_CATEGORIES' combined getCount values.
//   - Campus Lead (non-Founder staff): scoped to their own department —
//     CR requests + leave requests only, for the groups in their dept.
//     CL applications / QB uploads / etc. are Founder-only concerns and
//     intentionally excluded here (a CL can't act on them, so a badge
//     for them would just be noise the CL can't clear).
//
// Gated behind isRealAdmin — never fires any of these subscriptions for
// a plain student/faculty account.

import { useEffect, useState } from 'react';
import { useIsStaff } from './useIsStaff';
import { getProfile } from '../store/store';
import {
  listAllGroups, subscribeCRRequests, subscribeLeaveRequests,
  subscribeAllPendingJoinRequests,
} from '../lib/groupSync';
import { subscribeAllCLApplications, subscribeCLApplications } from '../lib/staffSync';
import { subscribeAllQBUploadRequests } from '../lib/qbUploadRequests';
import { subscribeProviderVerifyRequests } from '../lib/providerSync';
import { subscribeAccountDeleteRequests } from '../lib/accountDeleteRequests';
import { subscribePendingPublicationSubmissions } from '../lib/pendingPublicationsSync';
import { listAllFacultyAccounts } from '../lib/facultySync';

export function useAdminPendingCount() {
  const { isRealAdmin, adminLabel } = useIsStaff();
  const isFounder = adminLabel === 'Founder';

  const [groups, setGroups] = useState(null);
  const [crCountMap, setCrCountMap] = useState({});
  const [leaveCountMap, setLeaveCountMap] = useState({});

  // Founder-only pieces — never subscribed for a Campus Lead, since a CL
  // has no read access to most of these under firestore.rules anyway.
  const [clApplications, setClApplications] = useState(0);
  const [manualVerifyCount, setManualVerifyCount] = useState(0);
  const [qbUploadCount, setQbUploadCount] = useState(0);
  const [providerVerifyCount, setProviderVerifyCount] = useState(0);
  const [accountDeleteCount, setAccountDeleteCount] = useState(0);
  const [pendingPublications, setPendingPublications] = useState(0);
  const [facultyPending, setFacultyPending] = useState(0);

  // Campus Lead-only piece — their own dept's CL applications (e.g. a
  // co-CL vacancy application in their dept), separate from the
  // Founder's all-dept subscription above.
  const [clDeptApplications, setClDeptApplications] = useState(0);

  useEffect(() => {
    if (!isRealAdmin) return;
    listAllGroups().then(setGroups).catch(() => setGroups([]));
  }, [isRealAdmin]);

  // CR + leave request counts: every group for Founder, only the CL's
  // own dept's groups for a Campus Lead.
  useEffect(() => {
    if (!isRealAdmin || !groups) return;
    const profile = getProfile() || {};
    const myDept = String(profile.dept || '').trim().toUpperCase();
    const scopedGroups = isFounder ? groups : groups.filter((g) => g.dept === myDept);

    const unsubsCr = scopedGroups.map((g) => subscribeCRRequests(g.id, (reqs) => {
      setCrCountMap((prev) => ({ ...prev, [g.id]: reqs.length }));
    }));
    const unsubsLeave = scopedGroups.map((g) => subscribeLeaveRequests(g.id, (reqs) => {
      setLeaveCountMap((prev) => ({ ...prev, [g.id]: reqs.length }));
    }));
    return () => { unsubsCr.forEach((u) => u()); unsubsLeave.forEach((u) => u()); };
  }, [isRealAdmin, isFounder, groups]);

  useEffect(() => {
    if (!isRealAdmin || !isFounder) return;
    return subscribeAllCLApplications((apps) => setClApplications(apps.length));
  }, [isRealAdmin, isFounder]);

  useEffect(() => {
    if (!isRealAdmin || !isFounder) return;
    return subscribeAllPendingJoinRequests((reqs) => setManualVerifyCount(reqs.length));
  }, [isRealAdmin, isFounder]);

  useEffect(() => {
    if (!isRealAdmin || !isFounder) return;
    return subscribeAllQBUploadRequests((reqs) => setQbUploadCount(reqs.length));
  }, [isRealAdmin, isFounder]);

  useEffect(() => {
    if (!isRealAdmin || !isFounder) return;
    return subscribeProviderVerifyRequests((reqs) => setProviderVerifyCount(reqs.length));
  }, [isRealAdmin, isFounder]);

  useEffect(() => {
    if (!isRealAdmin || !isFounder) return;
    return subscribeAccountDeleteRequests((reqs) => setAccountDeleteCount(reqs.length));
  }, [isRealAdmin, isFounder]);

  useEffect(() => {
    if (!isRealAdmin || !isFounder) return;
    return subscribePendingPublicationSubmissions((subs) => setPendingPublications(subs.length));
  }, [isRealAdmin, isFounder]);

  useEffect(() => {
    if (!isRealAdmin || !isFounder) return;
    listAllFacultyAccounts()
      .then((list) => setFacultyPending((list || []).filter((f) => !f.verifiedAt).length))
      .catch(() => setFacultyPending(0));
  }, [isRealAdmin, isFounder]);

  useEffect(() => {
    if (!isRealAdmin || isFounder) return;
    const profile = getProfile() || {};
    const myDept = String(profile.dept || '').trim().toUpperCase();
    if (!myDept) return;
    return subscribeCLApplications(myDept, (apps) => setClDeptApplications(apps.length));
  }, [isRealAdmin, isFounder]);

  if (!isRealAdmin) return 0;

  const totalCrReq = Object.values(crCountMap).reduce((a, b) => a + b, 0);
  const totalLeaveReq = Object.values(leaveCountMap).reduce((a, b) => a + b, 0);

  if (isFounder) {
    return (
      clApplications + totalCrReq + totalLeaveReq + manualVerifyCount
      + qbUploadCount + providerVerifyCount + accountDeleteCount
      + pendingPublications + facultyPending
    );
  }

  // Campus Lead: their own dept's CR + leave requests + their own dept's
  // CL applications (e.g. co-CL vacancy applicants awaiting review).
  return totalCrReq + totalLeaveReq + clDeptApplications;
}
