
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

// --- Search Helpers ---

const cleanString = (str: string) => {
    return str.toLowerCase()
        .replace(/\(.*\)/g, '') 
        .replace(/\[.*\]/g, '') 
        .replace(/ - .*/, '') 
        .replace(/ ft\. .*/, '')
        .replace(/ feat\. .*/, '')
        .replace(/ featuring .*/, '')
        .replace(/,/g, '')
        .replace(/'/g, '')
        .trim();
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
      const queries = [
          `${cleanString(artist)} ${cleanString(title)}`,
          `${cleanString(title)} ${cleanString(artist)}`,
          `${cleanString(title)}`
      ];
      // Deduplicate queries
      const uniqueQueries = [...new Set(queries)];

      const MAX_RETRIES = 50; 
      let currentDelay = 200; 

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          let hitRateLimit = false;
          let technicalError = false;

          for (const query of uniqueQueries) {
              const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1&country=NL`;
              
              try {
                  const response = await fetch(url);
                  
                  // Rate Limit Detection
                  if (response.status === 429 || response.status === 403) {
                      throw new Error('RateLimit');
                  }
                  
                  if (!response.ok) {
                      // Server error (500), try next query but mark as tech error
                      technicalError = true;
                      continue; 
                  }

                  const data = await response.json();
                  if (data.results && data.results.length > 0) {
                      const track = data.results[0];
                      return {
                          coverUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : null,
                          previewUrl: track.previewUrl
                      };
                  }
                  
                  // If we are here: 200 OK, but results array is empty.
                  // Try the next query variation in the loop.
                  
              } catch (err: any) {
                  if (err.message === 'RateLimit') {
                      hitRateLimit = true;
                      break; // Break the query loop, force a sleep and retry
                  }
                  // Network error? Mark and try next query.
                  technicalError = true;
              }
          }

          // DECISION POINT:
          // If we hit a Rate Limit OR a Technical Error (like offline), we should Retry.
          if (hitRateLimit || technicalError) {
              // Backoff Logic
              const jitter = Math.random() * 500;
              const sleepTime = currentDelay + jitter;
              await new Promise(resolve => setTimeout(resolve, sleepTime));
              currentDelay = Math.min(currentDelay * 1.5, 10000);
              continue; // Retry outer loop
          }

          // If we are here, it means we tried all queries, got valid responses (200 OK),
          // but found ZERO results for any of them.
          // This song is not in iTunes. Do NOT retry.
          break; 
      }

      // If we fall through here, either max retries reached OR not found.
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
