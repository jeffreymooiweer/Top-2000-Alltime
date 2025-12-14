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

const API_BASE = 'https://api.top2000allertijden.nl';

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

// --- Helper Functions ---

const normalizeString = (str: string): string => {
    return str
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove diacritics
        .replace(/['’‘`´]/g, "'") // normalize apostrophes
        .replace(/\s+/g, ' ') // reduce multiple spaces
        .trim();
};

// --- Main Fetch Function ---

export const fetchSongMetadata = async (artist: string, title: string): Promise<{ coverUrl: string | null; previewUrl: string | null }> => {
    // Determine the deterministic key for caching and API lookup
    const normalizedKey = `${normalizeString(artist)}|${normalizeString(title)}`;
  
    // 1. Check Memory
    if (memoryCache.has(normalizedKey)) {
        return memoryCache.get(normalizedKey)!;
    }

    // 2. Check Pending
    if (pendingRequests.has(normalizedKey)) {
        return pendingRequests.get(normalizedKey)!;
    }

    // 3. Initiate Logic
    const processPromise = (async () => {
      
        // Check IndexedDB
        const dbEntry = await getFromDB(normalizedKey);
        if (dbEntry) {
            memoryCache.set(normalizedKey, dbEntry);
            return { coverUrl: dbEntry.coverUrl, previewUrl: dbEntry.previewUrl };
        }

        // 4. Network Fetch Strategy (Cloudflare Worker)
        try {
            // Step A: Check /mapped
            const mappedUrl = `${API_BASE}/itunes/mapped?key=${encodeURIComponent(normalizedKey)}`;
            const mappedResp = await fetch(mappedUrl);
            
            if (mappedResp.ok) {
                const mappedData = await mappedResp.json();
                if (mappedData.found) {
                    return {
                        coverUrl: mappedData.artworkUrl || null,
                        previewUrl: mappedData.previewUrl || null
                    };
                }
            }

            // Step B: Call /resolve if not found in mapped
            const resolveUrl = `${API_BASE}/itunes/resolve?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
            const resolveResp = await fetch(resolveUrl);

            if (resolveResp.ok) {
                const resolveData = await resolveResp.json();
                // The structure from resolve is likely similar to mapped or directly the metadata
                // Assuming it returns { found: boolean, artworkUrl: ..., previewUrl: ... } or just the fields
                // Based on user prompt "Resultaat van /resolve wordt direct gebruikt"
                
                return {
                    coverUrl: resolveData.artworkUrl || null,
                    previewUrl: resolveData.previewUrl || null
                };
            }
        } catch (err) {
            console.error('Error fetching metadata from worker:', err);
        }

        // If we fall through here, return nulls (not found or error)
        return { coverUrl: null, previewUrl: null };

    })().then(result => {
        // Save to caches (even if null, to prevent re-fetching known missing songs)
        const entry = { ...result, timestamp: Date.now() };
        memoryCache.set(normalizedKey, entry);
        putToDB(normalizedKey, entry);
      
        pendingRequests.delete(normalizedKey);
        return result;
    });

    pendingRequests.set(normalizedKey, processPromise);
    return processPromise;
};
