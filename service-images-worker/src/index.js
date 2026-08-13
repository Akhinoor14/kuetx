/**
 * KUETx Service Images — Cloudflare Worker
 * (MULTI_CATEGORY_SERVICES_PLAN.md Phase 3)
 *
 * Bindings required (set in wrangler.toml / dashboard):
 *   - SERVICE_IMAGES_BUCKET : R2 bucket binding, PUBLIC bucket (public
 *     read needed so student-facing ServiceDetail.jsx / Services.jsx can
 *     just <img src> the returned URL, same as the question-bank
 *     worker's QB_BUCKET public/ prefix).
 *   - FIREBASE_PROJECT_ID   : same Firebase project as every other worker
 *   - ALLOWED_ORIGIN        : deployed app origin
 *
 * Routes:
 *   POST   /upload  -> upload one image (multipart/form-data: file,
 *                      serviceId). Auth: must be the OWNING provider of
 *                      serviceId (verified via Firestore REST, same
 *                      pattern as the question-bank worker's isSCLFor()
 *                      etc). Rejects anything over 1MB or not an image
 *                      content-type. Returns { ok, url, key }.
 *   DELETE /image    -> delete a previously uploaded image by key. Auth:
 *                      same owning-provider check, re-derived from the
 *                      key's own embedded serviceId (key shape below) so
 *                      a provider can never delete another provider's
 *                      image just by knowing its key.
 *
 * Key shape: services/{serviceId}/{uuid}.{ext} — serviceId is embedded in
 * the key itself (not just the request body) so /image's delete auth can
 * re-derive which service a key belongs to directly from the key,
 * without trusting a client-supplied serviceId that might not match.
 *
 * IMPORTANT: This Worker does its OWN lightweight Firebase ID-token
 * verification (Google's public JWKS), copied from
 * cloudflare-worker/src/index.js's verifyFirebaseToken() — see that
 * file's own header comment for why (Workers can't use firebase-admin,
 * which needs Node APIs). This is the ONLY piece reused from that
 * worker; the R2 buckets and routes here are entirely new
 * (MULTI_CATEGORY_SERVICES_PLAN.md Phase 0 decision — the question-bank
 * worker/buckets are PDF-specific, not reused for image upload).
 */

const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1MB, per the plan
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function extForContentType(ct) {
  if (ct === 'image/png') return 'png';
  if (ct === 'image/webp') return 'webp';
  if (ct === 'image/gif') return 'gif';
  return 'jpg';
}

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
// Firebase ID token verification — copied verbatim from
// cloudflare-worker/src/index.js (same reasoning: no Node APIs in
// Workers, so no firebase-admin; pure fetch + WebCrypto against Google's
// public JWKS instead).
// ---------------------------------------------------------------------
let cachedJwks = null;
let cachedJwksAt = 0;

async function getGoogleJwks() {
  if (cachedJwks && Date.now() - cachedJwksAt < 3600_000) return cachedJwks;
  const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  const data = await res.json();
  cachedJwks = data.keys;
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
    ['verify'],
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToArrayBuffer(sigB64);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData);
  if (!valid) throw new Error('Bad signature');

  return payload;
}

// ---------------------------------------------------------------------
// Firestore REST helper — checks that `uid` owns services/{serviceId}
// (providerUid == uid), the same "re-derive from Firestore, never trust
// the client" pattern the question-bank worker uses for role checks.
// ---------------------------------------------------------------------
async function ownsService(env, serviceId, uid, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/services/${serviceId}`;
  const res = await fetch(url, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });
  if (res.status !== 200) return false;
  const doc = await res.json();
  const providerUid = doc.fields?.providerUid?.stringValue;
  return providerUid === uid;
}

// Open Errand Request Feed migration — errand request images reuse this
// same worker/bucket, but there's no services/{id} doc to check
// ownership against (an open request has no shop). Same
// "re-derive from Firestore, never trust the client" pattern, just
// checking errandRequests/{requestId} instead. Upload is
// requester-only (only the requester ever posts the image, at create
// time). Delete additionally allows the confirmed acceptor — either
// party may call finishErrandRequest() (see errandRequests.js), and
// finishing is what triggers image cleanup, so whichever of the two
// actually finishes it must be allowed to delete it.
async function ownsErrandRequest(env, requestId, uid, idToken, { allowConfirmedAcceptor = false } = {}) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/errandRequests/${requestId}`;
  const res = await fetch(url, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });
  if (res.status !== 200) return false;
  const doc = await res.json();
  const requesterUid = doc.fields?.requesterUid?.stringValue;
  if (requesterUid === uid) return true;
  if (allowConfirmedAcceptor) {
    const confirmedAcceptorUid = doc.fields?.confirmedAcceptorUid?.stringValue;
    if (confirmedAcceptorUid === uid) return true;
  }
  return false;
}

function requireBearerToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  return authHeader.replace(/^Bearer\s+/i, '');
}

// ---------------------------------------------------------------------
// POST /upload — multipart/form-data: file, serviceId, kind (optional)
//   kind === 'errand' -> serviceId field actually carries an
//   errandRequests/{requestId} id, ownership checked against
//   requesterUid instead of providerUid, key prefixed errands/ instead
//   of services/ (see ownsErrandRequest above for why this is a
//   separate check rather than reusing ownsService on a different
//   collection name).
// ---------------------------------------------------------------------
async function handleUpload(request, env) {
  const idToken = requireBearerToken(request);
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
  const serviceId = form.get('serviceId');
  const kind = form.get('kind') === 'errand' ? 'errand' : 'service';
  if (!file || typeof file === 'string') return json({ error: 'Missing file' }, env, 400);
  if (!serviceId) return json({ error: 'Missing serviceId' }, env, 400);

  const authorized = kind === 'errand'
    ? await ownsErrandRequest(env, serviceId, uid, idToken)
    : await ownsService(env, serviceId, uid, idToken);
  if (!authorized) return json({ error: kind === 'errand' ? 'Not authorized to upload images for this request' : 'Not authorized to upload images for this service' }, env, 403);

  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    return json({ error: `Unsupported image type: ${file.type || 'unknown'}` }, env, 400);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return json({ error: `Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)` }, env, 400);
  }

  const ext = extForContentType(file.type);
  const prefix = kind === 'errand' ? 'errands' : 'services';
  const key = `${prefix}/${serviceId}/${crypto.randomUUID()}.${ext}`;

  await env.SERVICE_IMAGES_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  // Public bucket — the caller constructs the public URL client-side from
  // this key using their own public-bucket base URL (custom domain or
  // r2.dev subdomain), same as the question-bank worker returns bare keys
  // for handleList() rather than baking a hostname into the worker.
  return json({ ok: true, key }, env);
}

// ---------------------------------------------------------------------
// DELETE /image — body: { key }. Key prefix (services/ vs errands/)
// determines which ownership check applies — same re-derive-from-the-
// key principle as before, just branching on two possible prefixes now
// instead of one.
// ---------------------------------------------------------------------
async function handleDelete(request, env) {
  const idToken = requireBearerToken(request);
  if (!idToken) return json({ error: 'Missing Authorization' }, env, 401);

  let claims;
  try {
    claims = await verifyFirebaseToken(idToken, env);
  } catch (e) {
    return json({ error: `Invalid token: ${e.message}` }, env, 401);
  }
  const uid = claims.sub || claims.user_id;

  const body = await request.json();
  const { key } = body;
  const isErrandKey = typeof key === 'string' && key.startsWith('errands/');
  const isServiceKey = typeof key === 'string' && key.startsWith('services/');
  if (!isErrandKey && !isServiceKey) {
    return json({ error: 'Invalid key (must start with "services/" or "errands/")' }, env, 400);
  }
  // Re-derive the owning id from the key itself, never from a separate
  // client-supplied field — closes the same class of gap the
  // question-bank worker's handleDeletePublicObject() guards against
  // with its "keys must start with public/" check.
  const ownerId = key.split('/')[1];
  if (!ownerId) return json({ error: 'Invalid key' }, env, 400);

  const authorized = isErrandKey
    ? await ownsErrandRequest(env, ownerId, uid, idToken, { allowConfirmedAcceptor: true })
    : await ownsService(env, ownerId, uid, idToken);
  if (!authorized) return json({ error: isErrandKey ? 'Not authorized to delete images for this request' : 'Not authorized to delete images for this service' }, env, 403);

  await env.SERVICE_IMAGES_BUCKET.delete(key);
  return json({ ok: true, deleted: key }, env);
}

// ---------------------------------------------------------------------
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors(env) });
    }
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/upload') return handleUpload(request, env);
      if (request.method === 'DELETE' && url.pathname === '/image') return handleDelete(request, env);
      return json({ error: 'Not found' }, env, 404);
    } catch (e) {
      return json({ error: e.message || 'Internal error' }, env, 500);
    }
  },
};
