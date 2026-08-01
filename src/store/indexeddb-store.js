/**
 * IndexedDB Store Layer for KUETx
 * Replaces localStorage with IndexedDB for 50MB+ storage capacity
 * Automatic migration from localStorage on first load
 * Same API as localStorage-based store
 */

const DB_NAME = 'KUETxDB';
const DB_VERSION = 1;
const STORE_NAME = 'kuetx_data';
const PREFIX = 'kuetx_';

let db = null;

/**
 * Initialize IndexedDB database
 */
export async function initDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;

      // BUGFIX (Profile Setup modal flashes on login/refresh, only fixed
      // by a hard refresh): the browser can close this connection out from
      // under us — most commonly React StrictMode's deliberate mount ->
      // unmount -> remount on first load opening a second indexedDB.open()
      // for the same DB_NAME/DB_VERSION, which fires `versionchange` on
      // this (the first) connection. Per the IndexedDB spec, a connection
      // that doesn't close itself in response to `versionchange` gets
      // forcibly closed by the browser once the second open() is blocked
      // waiting on it — after which every transaction on it throws
      // exactly the error seen in production: "Failed to execute
      // 'transaction' on 'IDBDatabase': The database connection is
      // closing." This module never listened for that, so the
      // module-level `db` variable kept pointing at a dead connection
      // forever — every `if (!db) await initDB()` guard elsewhere in this
      // file saw a truthy `db` and skipped reopening, so reads/writes
      // (including the profile hydrate that runs right after login) kept
      // silently failing until a full page refresh reset all JS module
      // state and opened a genuinely fresh connection.
      //
      // Fix: reset `db` to null on both `versionchange` and `close`, and
      // close the stale handle explicitly on `versionchange` (this is
      // also the spec-recommended way to let a second open() proceed
      // instead of sitting blocked). The next caller's `if (!db) await
      // initDB()` then correctly reopens a real, working connection
      // instead of continuing to use a closing one.
      db.onversionchange = () => {
        db.close();
        db = null;
      };
      db.onclose = () => {
        db = null;
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Get a value from IndexedDB
 */
export async function getFromDB(key) {
  try {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(PREFIX + key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (err) {
    console.error('[IndexedDB] Get error:', err);
    return null;
  }
}

/**
 * Set a value in IndexedDB
 */
export async function setInDB(key, value) {
  try {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, PREFIX + key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('[IndexedDB] Set error:', err);
  }
}

/**
 * Remove a key from IndexedDB
 */
export async function removeFromDB(key) {
  try {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(PREFIX + key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('[IndexedDB] Remove error:', err);
  }
}

/**
 * Get all keys AND values from IndexedDB in a single transaction/request
 * pair — used by store.js's ensureDBReady() to preload the memory cache
 * without opening one transaction per key (see that function's comment
 * for why the old approach was slow).
 */
export async function getAllEntriesFromDB() {
  try {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      let keys = null;
      let values = null;
      const tryResolve = () => {
        if (keys === null || values === null) return;
        const entries = [];
        for (let i = 0; i < keys.length; i++) {
          if (String(keys[i]).startsWith(PREFIX)) entries.push([keys[i], values[i]]);
        }
        resolve(entries);
      };
      keysRequest.onerror = () => reject(keysRequest.error);
      valuesRequest.onerror = () => reject(valuesRequest.error);
      keysRequest.onsuccess = () => { keys = keysRequest.result; tryResolve(); };
      valuesRequest.onsuccess = () => { values = valuesRequest.result; tryResolve(); };
    });
  } catch (err) {
    console.error('[IndexedDB] GetAllEntries error:', err);
    return [];
  }
}

/**
 * Get all keys from IndexedDB
 */
export async function getAllKeysFromDB() {
  try {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const keys = request.result.filter(k => k.startsWith(PREFIX));
        resolve(keys);
      };
    });
  } catch (err) {
    console.error('[IndexedDB] GetAllKeys error:', err);
    return [];
  }
}

/**
 * Get all data from IndexedDB
 */
export async function getAllFromDB() {
  try {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const keys = request.result;
        resolve(keys);
      };
    });
  } catch (err) {
    console.error('[IndexedDB] GetAll error:', err);
    return [];
  }
}

/**
 * Clear all data from IndexedDB
 */
export async function clearDB() {
  try {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error('[IndexedDB] Clear error:', err);
  }
}

/**
 * Migrate data from localStorage to IndexedDB
 */
export async function migrateFromLocalStorage() {
  try {
    await initDB();
    // BUGFIX: this used to be a sessionStorage flag, which is scoped to
    // ONE TAB SESSION — so every fresh tab, and every full page reload in
    // a browser that clears sessionStorage on close, re-ran this entire
    // scan-and-await-write loop even though the migration had already
    // completed permanently in IndexedDB long ago. That's one of the
    // biggest contributors to "refresh takes forever" across the whole
    // app. A real localStorage flag persists across reloads/tabs the same
    // way the migrated data itself does, so this now only ever runs once
    // per browser profile, not once per page load.
    const migrated = localStorage.getItem('kuetx_migrated_to_idb');
    if (migrated === 'true') return;

    const localStorageData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) {
        try {
          localStorageData[k] = JSON.parse(localStorage.getItem(k));
        } catch {}
      }
    }

    if (Object.keys(localStorageData).length > 0) {
      // Write all keys in ONE transaction instead of one transaction per
      // key via sequential `await setInDB()` — each setInDB() call opens
      // its own readwrite transaction and waits for it to fully commit
      // before starting the next, which serializes N round-trips to the
      // browser's storage engine one at a time. A single shared
      // transaction still writes every key but only pays that commit
      // cost once.
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        const objectStore = transaction.objectStore(STORE_NAME);
        for (const [key, value] of Object.entries(localStorageData)) {
          objectStore.put(value, key);
        }
      });
      console.log('[IndexedDB] Migrated', Object.keys(localStorageData).length, 'items from localStorage');
    }
    localStorage.setItem('kuetx_migrated_to_idb', 'true');
  } catch (err) {
    console.error('[IndexedDB] Migration error:', err);
  }
}

/**
 * Get storage usage in KB
 */
export async function getStorageUsage() {
  try {
    if (!db) await initDB();
    const allData = await getAllFromDB();
    let totalBytes = 0;
    for (const item of allData) {
      totalBytes += new Blob([JSON.stringify(item)]).size;
    }
    return (totalBytes / 1024).toFixed(1);
  } catch (err) {
    console.error('[IndexedDB] Usage calculation error:', err);
    return '0';
  }
}
