
const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:8787' 
  : 'https://api.top2000allertijden.nl';

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
}

export const searchYouTubeVideo = async (artist: string, title: string): Promise<YouTubeSearchResult | null> => {
  try {
    const response = await fetch(
      `${API_BASE}/youtube/search?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to search YouTube video');
    }

    return await response.json();
  } catch (error) {
    console.error('YouTube search error:', error);
    return null;
  }
};
