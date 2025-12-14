
export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  imageUrl: string | null;
}

export const fetchNewsFeed = async (): Promise<NewsItem[]> => {
  try {
    const response = await fetch('https://api.top2000allertijden.nl/news');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("Error fetching news feed:", error);
  }
  return [];
};
