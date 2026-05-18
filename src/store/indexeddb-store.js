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
    const migrated = sessionStorage.getItem('kuetx_migrated_to_idb');
    if (migrated === 'true') return; // Already migrated in this session

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
      for (const [key, value] of Object.entries(localStorageData)) {
        await setInDB(key.replace(PREFIX, ''), value);
      }
      console.log('[IndexedDB] Migrated', Object.keys(localStorageData).length, 'items from localStorage');
      sessionStorage.setItem('kuetx_migrated_to_idb', 'true');
    }
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
