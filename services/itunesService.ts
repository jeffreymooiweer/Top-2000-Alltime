
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
      let data: { coverUrl: string | null; previewUrl: string | null } = { coverUrl: null, previewUrl: null };

      // 1. Try Worker Cache
      try {
          const response = await fetch(`https://api.top2000allertijden.nl/itunes?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
          if (response.ok) {
              data = await response.json();
              return data;
          }
      } catch (e) {
          console.warn("Worker cache check failed", e);
      }

      // 2. Fetch from iTunes Client-side (Fallback)
      try {
          const clean = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
          const queries = [
            `${artist} ${title}`,
            `${title} ${artist}`,
            title
          ];

          for (const q of queries) {
              const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1&country=NL`;
              const resp = await fetch(url);
              
              if (resp.ok) {
                  const json = await resp.json();
                  if (json.results && json.results.length > 0) {
                      const track = json.results[0];
                      data = {
                          coverUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '600x600') : null,
                          previewUrl: track.previewUrl
                      };

                      // 3. Cache result in Worker
                      // Fire and forget - don't block return
                      fetch('https://api.top2000allertijden.nl/itunes', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              artist,
                              title,
                              coverUrl: data.coverUrl,
                              previewUrl: data.previewUrl
                          })
                      }).catch(err => console.error("Failed to cache in worker", err));

                      break;
                  }
              }
          }
      } catch (e) {
          console.error("iTunes client fetch failed", e);
      }
      
      return data;
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
