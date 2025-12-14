import { API_BASE, normalizeString } from './config';

interface MetadataCacheEntry {
    coverUrl: string | null;
    previewUrl: string | null;
    timestamp: number;
}

const DB_NAME = 'top2000_cache_db';
const STORE_NAME = 'metadata_store';
const DB_VERSION = 1;

// In-memory mirror for instant access during session
const memoryCache: Map<string, MetadataCacheEntry> = new Map();
const pendingRequests = new Map<string, Promise<{ coverUrl: string | null; previewUrl: string | null }>>();

// --- IndexedDB Helpers ---

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
    });
};

const getFromDB = async (key: string): Promise<MetadataCacheEntry | undefined> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.data);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        return undefined;
    }
};

const putToDB = async (key: string, data: MetadataCacheEntry) => {
    try {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({ key, data });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("IDB Put Error", e);
    }
};

// --- Main Fetch Function ---

export const fetchSongMetadata = async (artist: string, title: string): Promise<{ coverUrl: string | null; previewUrl: string | null }> => {
  const cacheKey = `${artist}|${title}`.toLowerCase();
  
  // 1. Check Memory
  if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey)!;
  }

  // 2. Check Pending
  if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey)!;
  }

  // 3. Initiate Logic
  const processPromise = (async () => {
      
      // Check IndexedDB
      const dbEntry = await getFromDB(cacheKey);
      if (dbEntry) {
          memoryCache.set(cacheKey, dbEntry);
          return { coverUrl: dbEntry.coverUrl, previewUrl: dbEntry.previewUrl };
      }

      // Network Fetch Strategy
      try {
          const key = `${normalizeString(artist)}|${normalizeString(title)}`;
          
          // 1. Try mapped endpoint
          const mappedUrl = `${API_BASE}/itunes/mapped?key=${encodeURIComponent(key)}`;
          const mappedResponse = await fetch(mappedUrl);
          
          if (mappedResponse.ok) {
              const data = await mappedResponse.json();
              if (data.artworkUrl || data.previewUrl) {
                  return {
                      coverUrl: data.artworkUrl || null,
                      previewUrl: data.previewUrl || null
                  };
              }
          }

          // 2. Try resolve endpoint if mapped missed
          const resolveUrl = `${API_BASE}/itunes/resolve?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
          const resolveResponse = await fetch(resolveUrl);
          
          if (resolveResponse.ok) {
              const data = await resolveResponse.json();
              return {
                  coverUrl: data.artworkUrl || null,
                  previewUrl: data.previewUrl || null
              };
          }

      } catch (err) {
          console.error("Metadata fetch error:", err);
      }

      // Not found or error
      return { coverUrl: null, previewUrl: null };

  })().then(result => {
      // Save to caches (even if null, to prevent re-fetching known missing songs)
      const entry = { ...result, timestamp: Date.now() };
      memoryCache.set(cacheKey, entry);
      putToDB(cacheKey, entry);
      
      pendingRequests.delete(cacheKey);
      return result;
  });

  pendingRequests.set(cacheKey, processPromise);
  return processPromise;
};

export const prefetchMetadata = (songs: {artist: string, title: string}[]) => {
    // Only prefetch if passed array is valid
    if (!songs || songs.length === 0) return;

    songs.forEach((s, index) => {
        // Stagger requests slightly to prevent browser queue lockup
        setTimeout(() => {
            fetchSongMetadata(s.artist, s.title);
        }, index * 100);
    });
};
