/**
 * driveSync.js — KUETx Google Drive Real-Time Sync
 *
 * - OAuth 2.0 via Google Identity Services (GSI) — no server needed
 * - Scope: drive.file (only files created by KUETx, nothing else in Drive)
 * - Each user's data goes to their own Drive: "KUETx Backups/kuetx-backup.json"
 * - Zero data touches any KUETx server
 *
 * SYNC MODEL (client-only, no backend — so "near real-time" via short polling):
 *  - Any local change (store emits 'kuetx:store-updated') → debounced PUSH (4s)
 *  - Background poll every POLL_INTERVAL_MS → checks Drive file's modifiedTime;
 *    if remote is newer than the last version we pushed/pulled → PULL + merge
 *  - On 'online' and tab becoming visible → immediate pull check
 *  - Manual "Sync Now" → pull (merge) then push, used for instant cross-device sync
 *
 * Conflict rule: whole-file last-write-wins by modifiedTime. Good enough for a
 * single user syncing across their own devices; not a per-field CRDT merge.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'KUETx Backups';
const FILE_NAME = 'kuetx-backup.json';

const STORE_TOKEN_KEY = 'kuetx_drive_token';
const STORE_EMAIL_KEY = 'kuetx_drive_email';
const STORE_LAST_BACKUP_KEY = 'kuetx_drive_last_backup';
const STORE_FOLDER_ID_KEY = 'kuetx_drive_folder_id';
const STORE_LAST_REMOTE_MTIME_KEY = 'kuetx_drive_last_remote_mtime';

const PUSH_DEBOUNCE_MS = 4000;   // wait 4s after last change before pushing
const POLL_INTERVAL_MS = 20000;  // check Drive every 20s for changes from other devices

// ─── Token helpers ──────────────────────────────────────────────────────────

export const getDriveToken = () => {
  try {
    const raw = localStorage.getItem(STORE_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORE_TOKEN_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const saveDriveToken = (tokenResponse) => {
  const data = {
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() + (tokenResponse.expires_in || 3600) * 1000 - 60000,
  };
  localStorage.setItem(STORE_TOKEN_KEY, JSON.stringify(data));
  return data;
};

const clearDriveToken = () => {
  localStorage.removeItem(STORE_TOKEN_KEY);
  localStorage.removeItem(STORE_EMAIL_KEY);
  localStorage.removeItem(STORE_FOLDER_ID_KEY);
  localStorage.removeItem(STORE_LAST_REMOTE_MTIME_KEY);
};

export const getDriveEmail = () => localStorage.getItem(STORE_EMAIL_KEY) || null;
export const getDriveLastBackup = () => localStorage.getItem(STORE_LAST_BACKUP_KEY) || null;
export const isDriveConnected = () => !!getDriveToken();

const emitSyncEvent = (detail) => {
  try {
    window.dispatchEvent(new CustomEvent('kuetx:drive-sync', { detail }));
    window.dispatchEvent(new Event('kuetx:drive-updated'));
  } catch {}
};

// ─── GSI loader ─────────────────────────────────────────────────────────────

const loadGSI = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

let _tokenClient = null;

/**
 * Silently try to refresh the access token without a popup.
 * Only works if the user has an active Google session / prior consent.
 */
const silentTokenRefresh = () =>
  new Promise((resolve) => {
    (async () => {
      try {
        await loadGSI();
        if (!CLIENT_ID) { resolve(false); return; }
        if (!_tokenClient) {
          _tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE,
            callback: (tokenResponse) => {
              if (tokenResponse && !tokenResponse.error) {
                saveDriveToken(tokenResponse);
                resolve(true);
              } else {
                resolve(false);
              }
            },
          });
        }
        _tokenClient.requestAccessToken({ prompt: '' });
      } catch {
        resolve(false);
      }
    })();
  });

/**
 * Returns a valid access token, refreshing silently if needed.
 */
const getValidAccessToken = async () => {
  let token = getDriveToken();
  if (token) return token.accessToken;

  if (!localStorage.getItem(STORE_EMAIL_KEY)) {
    throw new Error('Not connected to Google Drive');
  }
  const refreshed = await silentTokenRefresh();
  token = getDriveToken();
  if (refreshed && token) return token.accessToken;
  throw new Error('Session expired — please reconnect Drive');
};

// ─── Auth ────────────────────────────────────────────────────────────────────

export const signInWithGoogle = () =>
  new Promise(async (resolve, reject) => {
    try {
      await loadGSI();

      if (!CLIENT_ID) {
        reject(new Error('VITE_GOOGLE_CLIENT_ID not set in .env'));
        return;
      }

      _tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error));
            return;
          }
          const saved = saveDriveToken(tokenResponse);

          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${saved.accessToken}` },
            });
            const info = await res.json();
            if (info.email) {
              localStorage.setItem(STORE_EMAIL_KEY, info.email);
            }
          } catch {}

          resolve(saved);
        },
      });

      _tokenClient.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });

export const signOutFromDrive = () => {
  const token = getDriveToken();
  if (token?.accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token.accessToken, () => {});
    } catch {}
  }
  stopAutoSync();
  clearDriveToken();
};

// ─── Drive API helpers ───────────────────────────────────────────────────────

const driveGet = async (url, token) => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  return res.json();
};

const getOrCreateFolder = async (accessToken) => {
  const cached = localStorage.getItem(STORE_FOLDER_ID_KEY);
  if (cached) return cached;

  const query = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await driveGet(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    accessToken
  );

  if (searchRes.files && searchRes.files.length > 0) {
    const id = searchRes.files[0].id;
    localStorage.setItem(STORE_FOLDER_ID_KEY, id);
    return id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!createRes.ok) throw new Error('Failed to create Drive folder');
  const folder = await createRes.json();
  localStorage.setItem(STORE_FOLDER_ID_KEY, folder.id);
  return folder.id;
};

const findBackupFile = async (accessToken, folderId) => {
  const query = encodeURIComponent(
    `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
  );
  const res = await driveGet(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`,
    accessToken
  );
  return res.files?.[0] || null;
};

/**
 * Lightweight check: just get the remote file's modifiedTime, no download.
 */
export const getRemoteMeta = async () => {
  const accessToken = await getValidAccessToken();
  const folderId = await getOrCreateFolder(accessToken);
  const file = await findBackupFile(accessToken, folderId);
  return file ? { id: file.id, modifiedTime: file.modifiedTime } : null;
};

// ─── Upload ──────────────────────────────────────────────────────────────────

export const uploadToDrive = async (data) => {
  const accessToken = await getValidAccessToken();
  const payload = {
    ...data,
    _driveBackupAt: new Date().toISOString(),
    _version: '1.0',
  };
  const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });

  const folderId = await getOrCreateFolder(accessToken);
  const existing = await findBackupFile(accessToken, folderId);

  let res;
  if (existing) {
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify({ name: FILE_NAME })], { type: 'application/json' })
    );
    form.append('file', jsonBlob);

    res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      }
    );
  } else {
    const form = new FormData();
    form.append(
      'metadata',
      new Blob(
        [JSON.stringify({ name: FILE_NAME, parents: [folderId] })],
        { type: 'application/json' }
      )
    );
    form.append('file', jsonBlob);

    res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      }
    );
  }

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const uploaded = await res.json();

  try {
    const meta = await driveGet(
      `https://www.googleapis.com/drive/v3/files/${uploaded.id}?fields=modifiedTime`,
      accessToken
    );
    if (meta.modifiedTime) {
      localStorage.setItem(STORE_LAST_REMOTE_MTIME_KEY, meta.modifiedTime);
    }
  } catch {}

  const now = new Date().toISOString();
  localStorage.setItem(STORE_LAST_BACKUP_KEY, now);
  return now;
};

// ─── Download ────────────────────────────────────────────────────────────────

export const downloadFromDrive = async () => {
  const accessToken = await getValidAccessToken();
  const folderId = await getOrCreateFolder(accessToken);
  const file = await findBackupFile(accessToken, folderId);

  if (!file) throw new Error('No backup file found in Drive');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const data = await res.json();
  localStorage.setItem(STORE_LAST_REMOTE_MTIME_KEY, file.modifiedTime);
  return { data, modifiedTime: file.modifiedTime };
};

// ─── Merge ───────────────────────────────────────────────────────────────────

/**
 * Whole-file last-write-wins merge: remote keys overwrite local keys with the
 * same name, but local-only keys (not present in the remote blob) are kept.
 */
const mergeForPull = (localData, remoteData) => {
  const merged = { ...localData };
  for (const [k, v] of Object.entries(remoteData)) {
    if (k.startsWith('kuetx_')) merged[k] = v;
  }
  return merged;
};

// ─── Real-time auto sync engine ─────────────────────────────────────────────

let _pushTimer = null;
let _pollTimer = null;
let _exportFn = null;
let _importFn = null;
let _syncing = false;
let _onStoreUpdate = null;
let _onVisibility = null;
let _onOnline = null;

const setStatus = (status, extra = {}) => emitSyncEvent({ status, ...extra });

const pullIfNewer = async () => {
  if (!isDriveConnected()) return false;
  try {
    const meta = await getRemoteMeta();
    if (!meta) return false;
    const lastSeen = localStorage.getItem(STORE_LAST_REMOTE_MTIME_KEY);
    if (lastSeen && new Date(meta.modifiedTime) <= new Date(lastSeen)) {
      return false;
    }
    const { data } = await downloadFromDrive();
    const localData = _exportFn ? _exportFn() : {};
    const merged = mergeForPull(localData, data);
    if (_importFn) await _importFn(merged);
    return true;
  } catch (err) {
    console.warn('[KUETx Drive] Pull check failed:', err.message);
    return false;
  }
};

const pushNow = async () => {
  if (!isDriveConnected() || !_exportFn) return;
  try {
    await uploadToDrive(_exportFn());
  } catch (err) {
    console.warn('[KUETx Drive] Push failed:', err.message);
  }
};

/**
 * Manual "Sync Now": pull+merge first (don't clobber another device's newer
 * edits), then push local state up so this device's edits are saved too.
 */
export const syncNow = async () => {
  if (!isDriveConnected()) throw new Error('Not connected to Google Drive');
  if (_syncing) return;
  _syncing = true;
  setStatus('syncing');
  try {
    await pullIfNewer();
    await pushNow();
    setStatus('synced', { at: new Date().toISOString() });
  } catch (err) {
    setStatus('error', { message: err.message });
    throw err;
  } finally {
    _syncing = false;
  }
};

/**
 * Start the background real-time sync engine.
 * @param {Function} exportFn - () => plain object of all kuetx_ data (store.exportAll)
 * @param {Function} importFn - async (data) => void (store.importAllReport)
 */
export const startAutoSync = (exportFn, importFn) => {
  _exportFn = exportFn;
  _importFn = importFn;
  if (!isDriveConnected()) return;

  stopAutoSync();

  _onStoreUpdate = () => {
    if (!isDriveConnected()) return;
    clearTimeout(_pushTimer);
    setStatus('pending');
    _pushTimer = setTimeout(async () => {
      if (_syncing) return;
      _syncing = true;
      setStatus('syncing');
      try {
        await pushNow();
        setStatus('synced', { at: new Date().toISOString() });
      } finally {
        _syncing = false;
      }
    }, PUSH_DEBOUNCE_MS);
  };
  window.addEventListener('kuetx:store-updated', _onStoreUpdate);

  _pollTimer = setInterval(async () => {
    if (_syncing) return;
    _syncing = true;
    try {
      const pulled = await pullIfNewer();
      if (pulled) setStatus('synced', { at: new Date().toISOString(), remote: true });
    } finally {
      _syncing = false;
    }
  }, POLL_INTERVAL_MS);

  _onVisibility = () => {
    if (document.visibilityState === 'visible') pullIfNewer();
  };
  document.addEventListener('visibilitychange', _onVisibility);

  _onOnline = () => { pullIfNewer(); };
  window.addEventListener('online', _onOnline);

  pullIfNewer();
};

export const stopAutoSync = () => {
  clearTimeout(_pushTimer);
  clearInterval(_pollTimer);
  if (_onStoreUpdate) window.removeEventListener('kuetx:store-updated', _onStoreUpdate);
  if (_onVisibility) document.removeEventListener('visibilitychange', _onVisibility);
  if (_onOnline) window.removeEventListener('online', _onOnline);
  _onStoreUpdate = null;
  _onVisibility = null;
  _onOnline = null;
  _pushTimer = null;
  _pollTimer = null;
};
