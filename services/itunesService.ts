
interface MetadataCacheEntry {
    coverUrl: string | null;
    previewUrl: string | null;
}

const memoryCache: Map<string, MetadataCacheEntry> = new Map();
const pendingRequests = new Map<string, Promise<{ coverUrl: string | null; previewUrl: string | null }>>();

export const fetchSongMetadata = async (artist: string, title: string): Promise<{ coverUrl: string | null; previewUrl: string | null }> => {
  const cacheKey = `${artist}|${title}`.toLowerCase();
  
  if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey)!;
  }

  if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey)!;
  }

  const processPromise = (async () => {
      try {
          const response = await fetch(`https://api.top2000allertijden.nl/itunes?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
          if (response.ok) {
              const data = await response.json();
              return data;
          } else {
              console.error(`Metadata fetch failed: ${response.status} ${response.statusText} for ${artist} - ${title}`);
          }
      } catch (e) {
          console.error("Error fetching metadata", e);
      }
      return { coverUrl: null, previewUrl: null };
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
