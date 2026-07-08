// emailDomainCheck.js — reject email addresses whose domain can't
// actually receive mail, before we let Firebase create an account for it.
//
// Three layers, cheapest first:
//   1. Instant blocklist of TLD/pattern junk people type by mistake or
//      out of laziness (.bom, .con, .cmo, keyboard-adjacent typos of
//      .com, obviously fake single/double-letter TLDs, disposable/temp
//      mail providers). No network call — instant onBlur feedback.
//   2. Instant typo-distance check against a short list of common real
//      providers (gmail.com, stud.kuet.ac.bd, etc). Catches near-miss
//      typos like "gmial.com" or "yahooo.com" that are themselves
//      syntactically valid, sometimes-even-registered domains, so the
//      blocklist and MX check alone would never catch them. No network
//      call — pure string distance.
//   3. Real MX-record (with A-record fallback) lookup via Cloudflare's
//      DNS-over-HTTPS resolver (public, free, CORS-enabled, no API key).
//      If the domain has no mail server AND no A/AAAA record either,
//      nothing can ever be delivered there, so we reject it. This is
//      the ONLY layer that needs network, and the only one that can
//      catch a domain that's syntactically fine but doesn't exist.
//
// checkEmailDomain() (async, layers 1+2+3) is the actual registration
// gate — call it in AuthModal before creating the account. It fails
// OPEN only on the network step (layer 3): if the DNS check itself
// can't complete (offline, resolver blocked on campus wifi, etc), we
// let the signup through rather than lock out a real student over an
// infra hiccup. Layers 1 and 2 never fail open — they're local string
// checks with no network dependency to fail.
//
// isObviouslyBadDomain() (sync, layers 1+2) is for INSTANT onBlur UI
// feedback only, before the async check runs on submit. It is not the
// registration gate by itself.

const BAD_TLD_PATTERNS = [
  /\.bom$/i, /\.con$/i, /\.cmo$/i, /\.comm$/i,
  /\.xom$/i, /\.vom$/i, /\.ocm$/i, /\.clom$/i, /\.copm$/i,
  /\.tset$/i, /\.test$/i, /\.invalid$/i, /\.example$/i, /\.localhost$/i,
  /\.fake$/i, /\.asdf$/i, /\.xyz123$/i,
  // NOTE: .co is a real ccTLD (Colombia, also used by some startups) —
  // deliberately NOT blocked. Do not add /\.co$/ here.
];

// Domains that are syntactically valid but are known disposable/temp-mail
// providers — block these too since they defeat the point of having a
// real account (throwaway inbox, no real ownership).
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'guerrillamail.com', 'yopmail.com',
  '10minutemail.com', 'throwawaymail.com', 'trashmail.com', 'fakeinbox.com',
  'sharklasers.com', 'getnada.com', 'dispostable.com',
]);

// Common real providers we check typo-distance against. Kept short and
// high-confidence on purpose: a large/loose list produces false positives
// (rejecting a real, uncommon-but-valid domain because it happens to be
// "close" to something on the list). KUET's own domains are included
// since a typo there is exactly the case that matters most here.
const KNOWN_GOOD_DOMAINS = [
  'gmail.com', 'stud.kuet.ac.bd', 'kuet.ac.bd', 'outlook.com', 'hotmail.com',
  'yahoo.com', 'icloud.com', 'protonmail.com', 'proton.me', 'live.com',
];

function getDomain(email) {
  if (typeof email !== 'string') return null;
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

// Standard Levenshtein edit distance, iterative (no recursion, no
// external dependency — this file has zero imports and should stay
// that way, it's called on every keystroke-adjacent onBlur).
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Returns the closest known-good domain if `domain` is a near-miss typo
// of it (small edit distance, and never equal to it — exact matches
// aren't typos). Returns null if it's not suspiciously close to
// anything, i.e. it's either already correct or genuinely a different
// domain. Distance threshold scales down for short domains so we don't
// flag short-but-legitimate domains as typos of something else.
function closestTypoOf(domain) {
  if (!domain) return null;
  let best = null;
  let bestDist = Infinity;
  for (const good of KNOWN_GOOD_DOMAINS) {
    if (domain === good) return null; // exact match, not a typo
    const dist = editDistance(domain, good);
    if (dist < bestDist) { bestDist = dist; best = good; }
  }
  if (!best) return null;
  const maxAllowed = best.length <= 6 ? 1 : 2;
  return bestDist <= maxAllowed ? best : null;
}

// Quick synchronous check — no network. Use for instant feedback as the
// user types (onBlur), before the async MX check runs on submit.
// Returns boolean (true = looks bad). For the typo-suggestion string,
// use getTypoSuggestion() below.
export function isObviouslyBadDomain(email) {
  const domain = getDomain(email);
  if (!domain) return true;
  if (!domain.includes('.')) return true;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  if (BAD_TLD_PATTERNS.some((re) => re.test(domain))) return true;
  return !!closestTypoOf(domain);
}

// Sync, no network. If the email's domain looks like a typo of a known
// real provider, returns the suggested correct domain (e.g. "gmail.com"
// for "gmial.com"). Returns null otherwise. Used to power a friendly
// "did you mean gmail.com?" hint distinct from the harder blocklist
// warning.
export function getTypoSuggestion(email) {
  const domain = getDomain(email);
  if (!domain || !domain.includes('.')) return null;
  return closestTypoOf(domain);
}

async function resolveDns(domain, type) {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
    { headers: { accept: 'application/dns-json' } }
  );
  if (!res.ok) throw new Error(`DoH HTTP ${res.status}`);
  return res.json();
}

// Full check — call this before actually creating the account.
// Returns { ok: true } or
// { ok: false, reason: 'invalid' | 'disposable' | 'blocklist' | 'typo', suggestion? }
//   for the three no-network, never-fail-open cases, or
// { ok: false, reason: 'no-mx' } for the network case (which itself
//   fails OPEN to { ok: true } on any network error, see below).
export async function checkEmailDomain(email) {
  const domain = getDomain(email);
  if (!domain || !domain.includes('.')) {
    return { ok: false, reason: 'invalid' };
  }
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: 'disposable' };
  }
  if (BAD_TLD_PATTERNS.some((re) => re.test(domain))) {
    return { ok: false, reason: 'blocklist' };
  }
  const typoOf = closestTypoOf(domain);
  if (typoOf) {
    return { ok: false, reason: 'typo', suggestion: typoOf };
  }

  // Network layer — MX record, with A/AAAA fallback per RFC 5321 §5.1
  // (a domain with no MX but a valid A/AAAA record is legal and some
  // legitimate small mail setups rely on exactly this, so rejecting on
  // missing-MX alone would false-positive on real students). Fails open
  // on any network problem so campus wifi blocking DoH, or the resolver
  // being briefly down, never locks out a real signup.
  try {
    const mx = await resolveDns(domain, 'MX');
    if (mx.Status === 0 && mx.Answer && mx.Answer.length > 0) {
      return { ok: true };
    }
    // No usable MX — try A record fallback before rejecting.
    try {
      const a = await resolveDns(domain, 'A');
      if (a.Status === 0 && a.Answer && a.Answer.length > 0) {
        return { ok: true };
      }
    } catch {
      // A-record lookup itself failed (network) — fail open rather
      // than reject on an incomplete check.
      return { ok: true };
    }
    return { ok: false, reason: 'no-mx' };
  } catch {
    return { ok: true }; // network error on the MX call itself — fail open
  }
}
