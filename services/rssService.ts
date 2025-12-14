import { API_BASE } from './config';

export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  imageUrl: string | null;
}

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

export const fetchNewsFeed = async (): Promise<NewsItem[]> => {
  // Check cache first
  const cached = getCachedFeed();
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${API_BASE}/news`);
    
    if (!response.ok) {
        console.error("News feed fetch failed", response.status);
        return [];
    }

    const data = await response.json();

    if (Array.isArray(data)) {
       // Assuming backend handles filtering and formatting to match NewsItem
       setCachedFeed(data);
       return data;
    }
    
    return [];
  } catch (error) {
    console.error("Error fetching news feed:", error);
    return [];
  }
};
