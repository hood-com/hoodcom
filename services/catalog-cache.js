const DB_NAME = 'hud-com-offline-cache';
const STORE = 'snapshots';
const VERSION = 1;
const READY_KEY = 'hud_full_catalog_ready_v1';
let dbPromise;
const openDB = () => {
  if (!('indexedDB' in globalThis)) return Promise.resolve(null);
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
};
export const getSnapshot = async (key) => {
  try { const db = await openDB(); if (!db) return null; return await new Promise((resolve, reject) => { const r=db.transaction(STORE,'readonly').objectStore(STORE).get(key); r.onsuccess=()=>resolve(r.result||null); r.onerror=()=>reject(r.error); }); } catch { return null; }
};
export const setSnapshot = async (key, value) => {
  const db=await openDB(); if (!db) return false;
  await new Promise((resolve,reject)=>{ const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put(value,key); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); }); return true;
};
export const clearSnapshots = async () => { const db=await openDB(); if(db) await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);}); try{localStorage.removeItem(READY_KEY);}catch{} };
export const markFullCatalogReady = () => { try { localStorage.setItem(READY_KEY, String(Date.now())); } catch {} };
export const getFullCatalogTimestamp = () => { try { return Number(localStorage.getItem(READY_KEY) || 0); } catch { return 0; } };
export const isFullCatalogReady = (maxAgeMs = 30 * 60 * 1000) => {
  const timestamp = getFullCatalogTimestamp();
  return timestamp > 0 && Date.now() - timestamp < maxAgeMs;
};
export const FULL_CATALOG_KEY = 'full-catalog-v1';
