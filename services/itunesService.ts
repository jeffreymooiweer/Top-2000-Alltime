
interface MetadataCacheEntry {
    coverUrl: string | null;
    previewUrl: string | null;
}

const memoryCache: Map<string, MetadataCacheEntry> = new Map();
const pendingRequests = new Map<string, Promise<{ coverUrl: string | null; previewUrl: string | null }>>();

// Helper for JSONP requests to bypass CORS
const fetchJsonp = (url: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        const callbackName = 'itunes_callback_' + Math.random().toString(36).substr(2, 9);
        const script = document.createElement('script');
        
        // Timeout handling
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP timeout'));
        }, 5000);

        const cleanup = () => {
             // @ts-ignore
             delete window[callbackName];
             if (document.body.contains(script)) {
                 document.body.removeChild(script);
             }
             clearTimeout(timeoutId);
        };

        // @ts-ignore
        window[callbackName] = (data: any) => {
            cleanup();
            resolve(data);
        };

        script.src = `${url}&callback=${callbackName}`;
        script.onerror = () => {
            cleanup();
            reject(new Error('JSONP script load error'));
        };

        document.body.appendChild(script);
    });
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
            `${clean(artist)} ${clean(title)}`,
            `${title} ${artist}`,
            title
          ];

          for (const q of queries) {
              // Try JSONP for iTunes as it supports it and avoids CORS issues
              const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1&country=NL`;
              
              try {
                  const json = await fetchJsonp(url);
                  
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
              } catch (innerErr) {
                  // Fallback to fetch if JSONP fails (unlikely for iTunes, but good safety)
                   // console.warn("JSONP failed, trying fetch", innerErr);
                   // If JSONP fails, normal fetch will likely fail too due to CORS, but let's leave it as is.
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
