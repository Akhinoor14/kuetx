/**
 * KUETx Question Bank — Cloudflare Worker
 *
 * Bindings required (set in wrangler.toml / dashboard):
 *   - QB_BUCKET       : R2 bucket binding, e.g. "kuetx-question-bank"
 *   - FIREBASE_PROJECT_ID : your Firebase project id (for ID-token verification)
 *   - ALLOWED_ORIGIN  : your deployed app origin, e.g. "https://kuetx.app"
 *
 * Routes:
 *   GET  /                 -> live public tree (what useQuestionBankData() fetches)
 *   POST /stage            -> Campus Lead uploads a PDF into staging/ (auth required)
 *   POST /approve          -> moves staging/{requestId}.pdf -> public/{key}.pdf (auth: SCL/Founder, checked server-side too)
 *   POST /reject            -> deletes staging/{requestId}.pdf
 *   DELETE /public-object   -> Founder-only: remove a live paper
 *
 * IMPORTANT: This Worker does its OWN lightweight Firebase ID-token
 * verification (Google's public JWKS) so it never trusts the client's
 * claimed uid/role. The actual "is this uid really the SCL of this dept"
 * check calls back into Firestore's REST API with the same token.
 */

const DEPARTMENTS = new Set([
  'ARCH', 'BME', 'BECM', 'CE', 'ChE', 'CSE', 'EEE', 'ECE',
  'ESE', 'IPE', 'LE', 'MSE', 'ME', 'MTE', 'TE', 'URP',
]);
const EXAM_TYPES = new Set(['Regular', 'Backlog', 'Special_Backlog', 'Online']);
const TERM_RE = /^Y[1-4]T[0-2]$/;

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env) },
  });
}

// ---------------------------------------------------------------------
// Firebase ID token verification (no SDK, pure fetch + Web Crypto —
// Workers can't use firebase-admin, which needs Node APIs).
// ---------------------------------------------------------------------
let cachedJwks = null;
let cachedJwksAt = 0;

// Google's JWK-format endpoint (NOT the x509 cert endpoint) — this one
// returns keys already in JWK form, which Workers' WebCrypto imports
// directly and reliably via importKey('jwk', ...). Same keys, different
// (much more Workers-friendly) encoding than the older x509 endpoint.
async function getGoogleJwks() {
  if (cachedJwks && Date.now() - cachedJwksAt < 3600_000) return cachedJwks;
  const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  const data = await res.json();
  cachedJwks = data.keys; // array of JWK objects, each with a "kid"
  cachedJwksAt = Date.now();
  return cachedJwks;
}

function base64UrlToArrayBuffer(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function verifyFirebaseToken(idToken, env) {
  const [headerB64, payloadB64, sigB64] = idToken.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error('Malformed token');

  const header = JSON.parse(atob(headerB64));
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

  if (payload.aud !== env.FIREBASE_PROJECT_ID) throw new Error('Bad audience');
  if (payload.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`) throw new Error('Bad issuer');
  if (payload.exp * 1000 < Date.now()) throw new Error('Token expired');

  const jwks = await getGoogleJwks();
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown key id');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToArrayBuffer(sigB64);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData);
  if (!valid) throw new Error('Bad signature');

  return payload; // contains payload.user_id / payload.sub == Firebase uid
}

// ---------------------------------------------------------------------
// Firestore REST helpers (checking staff/{uid}/roles/{roleId} existence)
// idToken is REQUIRED here — Firestore rules for admins/{uid} and
// staff/{uid}/roles/{role} both gate on isSignedIn() (request.auth.uid),
// which only exists if this REST call itself carries the caller's
// Firebase ID token as a Bearer credential. An unauthenticated fetch
// always evaluates to "not signed in" and silently returns false for
// every role check, no matter who's actually asking.
// ---------------------------------------------------------------------
async function firestoreDocExists(env, path, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });
  return res.status === 200;
}

async function isFounder(env, uid, idToken) {
  return firestoreDocExists(env, `admins/${uid}`, idToken);
}
async function isSCLFor(env, uid, dept, idToken) {
  return firestoreDocExists(env, `staff/${uid}/roles/senior_campus_lead_${dept}`, idToken);
}
async function isCLFor(env, uid, groupId, idToken) {
  return firestoreDocExists(env, `staff/${uid}/roles/campus_lead_${groupId}`, idToken);
}
async function isHeadOfOps(env, uid, idToken) {
  return firestoreDocExists(env, `staff/${uid}/roles/head_of_ops`, idToken);
}

// ---------------------------------------------------------------------
// GET / — public tree listing, consumed by useQuestionBankData()
// ---------------------------------------------------------------------
async function handleList(env) {
  const tree = {};
  let count = 0;
  let cursor;
  do {
    // QB_BUCKET (kuetx-question-bank) is the PUBLIC bucket — keys here
    // still keep the "public/" prefix for consistency with existing R2
    // key naming (R2_NAMING_CONVENTION.md), even though the bucket itself
    // is dedicated to public content. Staging files live in the SEPARATE
    // QB_STAGING_BUCKET (private bucket) — see handleStage/handleApprove.
    const listing = await env.QB_BUCKET.list({ prefix: 'public/', cursor, limit: 1000 });
    for (const obj of listing.objects) {
      // key: public/{DEPT}/{TERM}/{CourseCode}/{Label}.pdf
      const parts = obj.key.split('/');
      if (parts.length !== 5) continue;
      const [, dept, term, course, filename] = parts;
      const label = filename.replace(/\.pdf$/i, '');
      tree[dept] ??= {};
      tree[dept][term] ??= {};
      tree[dept][term][course] ??= [];
      tree[dept][term][course].push({
        label,
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
      });
      count++;
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  return json({ tree, count }, env);
}

// ---------------------------------------------------------------------
// POST /stage — Campus Lead uploads a PDF (multipart/form-data)
//   fields: file, dept, term, courseCode, examType, examYear, groupId, requestId
// Auth: any signed-in Firebase user; scope (own dept+batch only, or
// Founder = any dept) is verified here AND must independently be verified
// again at /approve time (never trust that staging alone implies scope
// was valid — belt & suspenders since Firestore rules also gate the
// qbUploadRequests doc write that accompanies this call).
// ---------------------------------------------------------------------
async function handleStage(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) return json({ error: 'Missing Authorization' }, env, 401);

  let claims;
  try {
    claims = await verifyFirebaseToken(idToken, env);
  } catch (e) {
    return json({ error: `Invalid token: ${e.message}` }, env, 401);
  }
  const uid = claims.sub || claims.user_id;

  const form = await request.formData();
  const file = form.get('file');
  const dept = String(form.get('dept') || '');
  const term = String(form.get('term') || '');
  const courseCode = String(form.get('courseCode') || '').replace(/\s+/g, '');
  const groupId = String(form.get('groupId') || '');
  const requestId = String(form.get('requestId') || '');

  if (!file || file.type !== 'application/pdf') {
    return json({ error: 'File must be a PDF' }, env, 400);
  }
  if (file.size > 100 * 1024 * 1024) {
    return json({ error: 'File exceeds 100MB limit' }, env, 400);
  }
  if (!DEPARTMENTS.has(dept)) return json({ error: `Unknown dept: ${dept}` }, env, 400);
  if (!TERM_RE.test(term)) return json({ error: `Invalid term: ${term}` }, env, 400);
  if (!courseCode) return json({ error: 'Missing courseCode' }, env, 400);
  if (!requestId) return json({ error: 'Missing requestId' }, env, 400);

  // Scope check: Founder can stage for any dept. Otherwise the uploader
  // must be the Campus Lead of exactly the group they claim.
  const founder = await isFounder(env, uid, idToken);
  if (!founder) {
    if (!groupId) return json({ error: 'Missing groupId' }, env, 400);
    const deptOfGroup = groupId.split('_')[1];
    if (deptOfGroup !== dept) return json({ error: 'groupId/dept mismatch' }, env, 400);
    const cl = await isCLFor(env, uid, groupId, idToken);
    if (!cl) return json({ error: 'Not the Campus Lead of this group' }, env, 403);
  }

  // Staged into the PRIVATE staging bucket, never the public one — this
  // is the actual fix for the "staging exposed via public bucket access"
  // risk: QB_STAGING_BUCKET has public access OFF, so an unreviewed file
  // is never reachable by URL no matter how the requestId is guessed.
  await env.QB_STAGING_BUCKET.put(`${requestId}.pdf`, file.stream(), {
    httpMetadata: { contentType: 'application/pdf' },
  });

  return json({ ok: true, requestId }, env);
}

// ---------------------------------------------------------------------
// POST /approve — moves staging/{requestId}.pdf -> public/{key}.pdf
//   body: { requestId, dept, term, courseCode, label, dept, groupDept }
// Auth: Founder, Head of Ops, or the SCL of `dept`.
// ---------------------------------------------------------------------
async function handleApprove(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) return json({ error: 'Missing Authorization' }, env, 401);

  let claims;
  try {
    claims = await verifyFirebaseToken(idToken, env);
  } catch (e) {
    return json({ error: `Invalid token: ${e.message}` }, env, 401);
  }
  const uid = claims.sub || claims.user_id;

  const body = await request.json();
  const { requestId, dept, term, courseCode, label, overwrite } = body;

  if (!DEPARTMENTS.has(dept)) return json({ error: `Unknown dept: ${dept}` }, env, 400);
  if (!TERM_RE.test(term)) return json({ error: `Invalid term: ${term}` }, env, 400);
  if (!requestId || !courseCode || !label) return json({ error: 'Missing fields' }, env, 400);

  const founder = await isFounder(env, uid, idToken);
  const headOfOps = founder || (await isHeadOfOps(env, uid, idToken));
  const scl = headOfOps || (await isSCLFor(env, uid, dept, idToken));
  if (!scl) return json({ error: 'Not authorized to approve for this dept' }, env, 403);

  const cleanCourse = String(courseCode).replace(/\s+/g, '');
  const cleanLabel = String(label).replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '_');
  const staged = await env.QB_STAGING_BUCKET.get(`${requestId}.pdf`);
  if (!staged) return json({ error: 'Staged file not found (already processed?)' }, env, 404);

  const destKey = `public/${dept}/${term}/${cleanCourse}/${cleanLabel}.pdf`;

  // Reject if something already exists at the destination — "same file
  // exists -> don't take the input" rule, applied at the storage layer
  // (Firestore rules / UI also check this against the live tree before
  // ever letting a request reach this point, this is the hard backstop).
  // `overwrite === true` is the one explicit escape hatch: only reachable
  // by a caller that already passed the `scl` auth check above (Founder /
  // Head of Ops / that dept's SCL), so a random uploader can never force
  // a replace — they simply don't have a way to set this flag to true.
  const existing = await env.QB_BUCKET.head(destKey);
  if (existing && !overwrite) {
    return json({ error: 'A paper with this exact name already exists — rename and resubmit.', code: 'DUPLICATE', existing: { size: existing.size, uploaded: existing.uploaded } }, env, 409);
  }

  await env.QB_BUCKET.put(destKey, staged.body, {
    httpMetadata: { contentType: 'application/pdf' },
  });
  await env.QB_STAGING_BUCKET.delete(`${requestId}.pdf`);

  return json({ ok: true, key: destKey }, env);
}

// ---------------------------------------------------------------------
// POST /reject — discard a staged file
// ---------------------------------------------------------------------
async function handleReject(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) return json({ error: 'Missing Authorization' }, env, 401);

  try {
    await verifyFirebaseToken(idToken, env);
  } catch (e) {
    return json({ error: `Invalid token: ${e.message}` }, env, 401);
  }

  const body = await request.json();
  const { requestId } = body;
  if (!requestId) return json({ error: 'Missing requestId' }, env, 400);

  await env.QB_STAGING_BUCKET.delete(`${requestId}.pdf`);
  return json({ ok: true }, env);
}

// ---------------------------------------------------------------------
// DELETE /public-object — Founder/Head of Ops only: remove one or more
// LIVE public papers. This is the second, independent gate behind the
// deleteRequests Firestore rule (belt & suspenders — same pattern as
// handleApprove's `scl` check above): a client that somehow got past the
// Firestore rule still can't get R2 to actually delete anything without
// also passing this server-side check.
//   body: { keys: ["public/CSE/Y1T1/CSE101/Midterm_2023.pdf", ...] }
// ---------------------------------------------------------------------
async function handleDeletePublicObject(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!idToken) return json({ error: 'Missing Authorization' }, env, 401);

  let claims;
  try {
    claims = await verifyFirebaseToken(idToken, env);
  } catch (e) {
    return json({ error: `Invalid token: ${e.message}` }, env, 401);
  }
  const uid = claims.sub || claims.user_id;

  const founder = await isFounder(env, uid, idToken);
  const authorized = founder || (await isHeadOfOps(env, uid, idToken));
  if (!authorized) return json({ error: 'Not authorized to delete public papers' }, env, 403);

  const body = await request.json();
  const { keys } = body;
  if (!Array.isArray(keys) || keys.length === 0) {
    return json({ error: 'keys must be a non-empty array' }, env, 400);
  }
  // Defense against path traversal / deleting arbitrary R2 keys — this
  // route may only ever touch the live public/ prefix, never staging/
  // or anything else in the bucket.
  for (const key of keys) {
    if (typeof key !== 'string' || !key.startsWith('public/')) {
      return json({ error: `Invalid key (must start with "public/"): ${key}` }, env, 400);
    }
  }

  const deleted = [];
  const notFound = [];
  for (const key of keys) {
    // R2 delete() doesn't error on a missing key, so head() first to
    // report which keys actually existed and were removed vs. were
    // already gone (e.g. a duplicate delete-request, or a race with
    // another Founder resolving the same item) — the frontend uses this
    // to set each deleteRequests.items[] entry's status accurately.
    const existing = await env.QB_BUCKET.head(key);
    if (!existing) {
      notFound.push(key);
      continue;
    }
    await env.QB_BUCKET.delete(key);
    deleted.push(key);
  }

  return json({ ok: true, deleted, notFound }, env);
}

// ---------------------------------------------------------------------
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors(env) });
    }
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/') return handleList(env);
      if (request.method === 'POST' && url.pathname === '/stage') return handleStage(request, env);
      if (request.method === 'POST' && url.pathname === '/approve') return handleApprove(request, env);
      if (request.method === 'POST' && url.pathname === '/reject') return handleReject(request, env);
      if (request.method === 'DELETE' && url.pathname === '/public-object') return handleDeletePublicObject(request, env);
      return json({ error: 'Not found' }, env, 404);
    } catch (e) {
      return json({ error: e.message || 'Internal error' }, env, 500);
    }
  },
};