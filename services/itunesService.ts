
interface MetadataCacheEntry {
    coverUrl: string | null;
    previewUrl: string | null;
}

const memoryCache: Map<string, MetadataCacheEntry> = new Map();
const pendingRequests = new Map<string, Promise<{ coverUrl: string | null; previewUrl: string | null }>>();

// Helper to fetch directly from iTunes if the worker fails/returns empty
const fetchFromItunesDirect = async (artist: string, title: string): Promise<MetadataCacheEntry> => {
    try {
        // Try multiple query formats if needed, but start simple
        const queries = [
            `${artist} ${title}`,
            `${title} ${artist}`,
            title
        ];

        for (const q of queries) {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1&country=NL`;
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    const track = data.results[0];
                    return {
                        coverUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '600x600') : null,
                        previewUrl: track.previewUrl
                    };
                }
            }
        }
    } catch (e) {
        console.warn("Direct iTunes fetch failed", e);
    }
    return { coverUrl: null, previewUrl: null };
};

export const fetchSongMetadata = async (artist: string, title: string): Promise<{ coverUrl: string | null; previewUrl: string | null }> => {
  const cacheKey = `${artist}|${title}`.toLowerCase();
  
  if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey)!;
  }

  if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey)!;
  }

  const processPromise = (async () => {
      // 1. Try Worker API first
      try {
          const response = await fetch(`https://api.top2000allertijden.nl/itunes?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
          if (response.ok) {
              const data = await response.json();
              // Only accept if we actually got a cover
              if (data && data.coverUrl) {
                  return data;
              }
          }
      } catch (e) {
          console.warn("Worker API error, falling back to direct fetch", e);
      }

      // 2. Fallback to Direct iTunes
      // This is necessary because the worker might have cached null results or be blocked
      return await fetchFromItunesDirect(artist, title);
  })();

  processPromise.then(result => {
      memoryCache.set(cacheKey, result);
      pendingRequests.delete(cacheKey);
  });

  pendingRequests.set(cacheKey, processPromise);
  return processPromise;
};

export const prefetchMetadata = (songs: {artist: string, title: string}[]) => {
    if (!songs || songs.length === 0) return;
    songs.forEach((s, index) => {
        // Simple stagger
        setTimeout(() => {
            fetchSongMetadata(s.artist, s.title);
        }, index * 50);
    });
};
