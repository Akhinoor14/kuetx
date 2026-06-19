/**
 * driveSync.js — KUETx Google Drive Backup Sync
 *
 * - OAuth 2.0 via Google Identity Services (GSI) — no server needed
 * - Scope: drive.file (only files created by KUETx, nothing else in Drive)
 * - Each user's data goes to their own Drive: "KUETx Backups/kuetx-backup.json"
 * - Zero data touches any KUETx server
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'KUETx Backups';
const FILE_NAME = 'kuetx-backup.json';
const STORE_TOKEN_KEY = 'kuetx_drive_token';
const STORE_EMAIL_KEY = 'kuetx_drive_email';
const STORE_LAST_BACKUP_KEY = 'kuetx_drive_last_backup';
const STORE_FOLDER_ID_KEY = 'kuetx_drive_folder_id';

// ─── Token helpers ──────────────────────────────────────────────────────────

export const getDriveToken = () => {
  try {
    const raw = localStorage.getItem(STORE_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Check expiry (token expires in 1 hour)
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
    expiresAt: Date.now() + (tokenResponse.expires_in || 3600) * 1000 - 60000, // 1 min buffer
  };
  localStorage.setItem(STORE_TOKEN_KEY, JSON.stringify(data));
  return data;
};

const clearDriveToken = () => {
  localStorage.removeItem(STORE_TOKEN_KEY);
  localStorage.removeItem(STORE_EMAIL_KEY);
  localStorage.removeItem(STORE_FOLDER_ID_KEY);
};

export const getDriveEmail = () => localStorage.getItem(STORE_DRIVE_EMAIL_KEY) || null;
export const getDriveLastBackup = () => localStorage.getItem(STORE_LAST_BACKUP_KEY) || null;
export const isDriveConnected = () => !!getDriveToken();

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

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Open Google OAuth popup and get access token.
 * Returns { accessToken, expiresAt } or throws.
 */
export const signInWithGoogle = () =>
  new Promise(async (resolve, reject) => {
    try {
      await loadGSI();

      if (!CLIENT_ID) {
        reject(new Error('VITE_GOOGLE_CLIENT_ID not set in .env'));
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error));
            return;
          }
          const saved = saveDriveToken(tokenResponse);

          // Fetch user email from Google
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

      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });

/**
 * Disconnect Drive — clears local token and cached folder ID.
 */
export const signOutFromDrive = () => {
  const token = getDriveToken();
  if (token?.accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(token.accessToken, () => {});
    } catch {}
  }
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

/**
 * Get or create "KUETx Backups" folder in user's Drive root.
 * Caches folder ID in localStorage.
 */
const getOrCreateFolder = async (accessToken) => {
  const cached = localStorage.getItem(STORE_FOLDER_ID_KEY);
  if (cached) return cached;

  // Search for existing folder
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

  // Create new folder
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

/**
 * Find existing backup file in the KUETx folder.
 */
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

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Upload full KUETx data to Drive.
 * Creates file if not exists, updates if exists.
 * @param {Object} data - plain object from store.exportAll()
 */
export const uploadToDrive = async (data) => {
  const token = getDriveToken();
  if (!token) throw new Error('Not connected to Google Drive');

  const { accessToken } = token;
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
    // Update existing file (PATCH multipart)
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
    // Create new file
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

  const now = new Date().toISOString();
  localStorage.setItem(STORE_LAST_BACKUP_KEY, now);
  return now;
};

// ─── Download ────────────────────────────────────────────────────────────────

/**
 * Download latest backup JSON from Drive.
 * @returns {Object} parsed backup data
 */
export const downloadFromDrive = async () => {
  const token = getDriveToken();
  if (!token) throw new Error('Not connected to Google Drive');

  const { accessToken } = token;
  const folderId = await getOrCreateFolder(accessToken);
  const file = await findBackupFile(accessToken, folderId);

  if (!file) throw new Error('No backup file found in Drive');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const data = await res.json();
  return { data, modifiedTime: file.modifiedTime };
};

// ─── Auto backup (debounced, max once per 24h) ───────────────────────────────

let _autoBackupTimer = null;

export const scheduleAutoBackup = (exportFn) => {
  if (!isDriveConnected()) return;

  const last = getDriveLastBackup();
  if (last) {
    const hoursSince = (Date.now() - new Date(last)) / 3600000;
    if (hoursSince < 24) return; // Already backed up within 24h
  }

  clearTimeout(_autoBackupTimer);
  _autoBackupTimer = setTimeout(async () => {
    try {
      const data = exportFn();
      await uploadToDrive(data);
    } catch (err) {
      console.warn('[KUETx Drive] Auto backup failed:', err.message);
    }
  }, 5000); // 5s delay after trigger
};

// Fix missing constant reference
const STORE_DRIVE_EMAIL_KEY = STORE_EMAIL_KEY;
