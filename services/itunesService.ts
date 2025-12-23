
interface MetadataCacheEntry {
    coverUrl: string | null;
    previewUrl: string | null;
}

const memoryCache: Map<string, MetadataCacheEntry> = new Map();
const pendingRequests = new Map<string, Promise<{ coverUrl: string | null; previewUrl: string | null }>>();

// Helper for Fetch with Timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 3000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(id);
    }
};

// Helper for JSONP requests to bypass CORS
const fetchJsonp = (url: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        const callbackName = 'itunes_callback_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error(`JSONP timeout for ${url}`));
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

        const sep = url.includes('?') ? '&' : '?';
        script.src = `${url}${sep}callback=${callbackName}`;
        
        script.onerror = () => {
            cleanup();
            reject(new Error('JSONP script load error'));
        };

        document.body.appendChild(script);
    });
};

// Helper for Proxy Fallback
const fetchViaProxy = async (targetUrl: string): Promise<any> => {
    // Using AllOrigins as a reliable CORS proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetchWithTimeout(proxyUrl, {}, 10000);
    if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
    return res.json();
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

      // 1. Try Worker Cache (Fastest)
      try {
          // Use timeout to avoid hanging on Cloudflare challenges
          const response = await fetchWithTimeout(`https://api.top2000allertijden.nl/itunes?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`, {}, 2000);
          
          if (response.ok) {
              const contentType = response.headers.get("content-type");
              if (contentType && contentType.includes("application/json")) {
                  data = await response.json();
                  // Only return if we actually have data, otherwise fall through to search
                  if (data.coverUrl || data.previewUrl) {
                      return data;
                  }
              }
          }
      } catch (e) {
          // Silent fail on worker error
          console.warn("Worker cache check failed/skipped", e);
      }

      // 2. Fetch from iTunes (Fallback Strategies)
      try {
          const queries = [
            `${artist} ${title}`,
            `${title} ${artist}`,
            title
          ];

          for (const q of queries) {
              const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1&country=NL`;
              
              let result = null;

              // Strategy A: JSONP (Preferred for Client-side)
              try {
                  result = await fetchJsonp(itunesUrl);
              } catch (jsonpErr) {
                  // Strategy B: Proxy (Last Resort)
                  try {
                       console.log("JSONP failed, trying Proxy...", q);
                       result = await fetchViaProxy(itunesUrl);
                  } catch (proxyErr) {
                       // console.warn("Proxy failed too", proxyErr);
                  }
              }

              // Process Result
              if (result && result.results && result.results.length > 0) {
                  const track = result.results[0];
                  data = {
                      coverUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '600x600') : null,
                      previewUrl: track.previewUrl
                  };

                  // 3. Cache result in Worker (Fire and forget)
                  fetch('https://api.top2000allertijden.nl/itunes', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          artist,
                          title,
                          coverUrl: data.coverUrl,
                          previewUrl: data.previewUrl
                      })
                  }).catch(() => {}); // Ignore cache errors

                  break; // Found it!
              }
          }
      } catch (e) {
          console.error("iTunes search completely failed", e);
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
