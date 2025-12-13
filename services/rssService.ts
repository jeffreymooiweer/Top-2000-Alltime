
export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  imageUrl: string | null;
}

const FEED_URL = 'https://www.nporadio2.nl/nieuws/rss';
const CACHE_KEY = 'news_feed_cache';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

interface CachedFeed {
  timestamp: number;
  data: NewsItem[];
}

const getCachedFeed = (): NewsItem[] | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedFeed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < CACHE_DURATION) {
      return parsed.data;
    }
  } catch (e) {
    console.warn("Error reading cache", e);
  }
  return null;
};

const setCachedFeed = (data: NewsItem[]) => {
  try {
    const cache: CachedFeed = {
      timestamp: Date.now(),
      data
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Error setting cache", e);
  }
};

const fetchRawContent = async (url: string): Promise<string | null> => {
    // Strategy 1: AllOrigins (Returns JSON with 'contents' field)
    // Preferred because it handles headers well
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&t=${Date.now()}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
            const data = await response.json();
            return data.contents;
        }
    } catch (e) {
        console.warn("AllOrigins proxy failed, trying fallback...", e);
    }

    // Strategy 2: CorsProxy.io (Returns raw text directly)
    // Good fallback
    try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (response.ok) {
            return await response.text();
        }
    } catch (e) {
        console.warn("CorsProxy failed", e);
    }

    return null;
};

export const fetchNewsFeed = async (): Promise<NewsItem[]> => {
  // Check cache first
  const cached = getCachedFeed();
  if (cached) {
    return cached;
  }

  try {
    const rawContent = await fetchRawContent(FEED_URL);
    
    if (!rawContent) {
        console.error("Could not fetch RSS feed from any proxy.");
        return [];
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(rawContent, "text/xml");
    const allItems = Array.from(xmlDoc.querySelectorAll("item"));

    // Filter logic: Only show items containing "Top 2000" (case insensitive)
    const filteredItems = allItems.filter(item => {
        const title = item.querySelector("title")?.textContent || "";
        const description = item.querySelector("description")?.textContent || "";
        const category = item.querySelector("category")?.textContent || "";
        
        const combinedText = `${title} ${description} ${category}`.toLowerCase();
        return combinedText.includes("top 2000") || combinedText.includes("top2000");
    });

    const result = filteredItems.slice(0, 3).map((item) => {
      const title = item.querySelector("title")?.textContent || "Nieuwsbericht";
      const link = item.querySelector("link")?.textContent || "#";
      const pubDateStr = item.querySelector("pubDate")?.textContent || "";
      
      // Attempt to parse date nicely
      let pubDate = "";
      try {
        pubDate = new Date(pubDateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
      } catch (e) {
        pubDate = pubDateStr;
      }
      
      // Clean description: remove HTML tags
      const rawDesc = item.querySelector("description")?.textContent || "";
      const description = rawDesc.replace(/<[^>]*>?/gm, '').slice(0, 120) + '...';

      // Attempt to find an image in <enclosure> or <media:content>
      let imageUrl: string | null = null;
      const enclosure = item.querySelector("enclosure");
      if (enclosure && enclosure.getAttribute("type")?.startsWith("image")) {
        imageUrl = enclosure.getAttribute("url");
      }

      // NPO Radio 2 often uses media:content (namespaced)
      if (!imageUrl) {
          const mediaContent = item.getElementsByTagNameNS("*", "content");
          for (let i = 0; i < mediaContent.length; i++) {
              const url = mediaContent[i].getAttribute("url");
              const type = mediaContent[i].getAttribute("type");
              if (url && type?.startsWith("image")) {
                  imageUrl = url;
                  break;
              }
          }
      }

      // If still no image found, try to extract from description HTML (sometimes embedded there)
      if (!imageUrl) {
         const imgMatch = rawDesc.match(/src="([^"]+)"/);
         if (imgMatch) imageUrl = imgMatch[1];
      }

      return {
        title,
        link,
        description,
        pubDate,
        imageUrl
      };
    });

    if (result.length > 0) {
      setCachedFeed(result);
    }
    
    return result;
  } catch (error) {
    console.error("Error parsing RSS feed:", error);
    return [];
  }
};
