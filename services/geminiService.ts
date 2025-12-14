// services/geminiService.ts
// Fetches song analysis from the Cloudflare Worker, which uses Groq API.

const API_BASE_URL = "https://api.top2000allertijden.nl";

const getFallbackAnalysis = (artist: string, title: string) => {
    return `"${title}" van ${artist} is een vaste waarde in de Top 2000. Het nummer roept bij veel luisteraars nostalgische gevoelens op en wordt jaarlijks door duizenden mensen gekozen als een van de beste nummers aller tijden.`;
};

export const getSongAnalysis = async (
  artist: string,
  title: string
): Promise<string> => {
  const fallback = getFallbackAnalysis(artist, title);

  try {
    const url = `${API_BASE_URL}/analyze?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
    const response = await fetch(url);

    if (!response.ok) {
        console.warn(`Worker API error: ${response.status}`);
        return fallback;
    }

    const data: { text?: string, error?: string } = await response.json();
    
    if (data.error) {
        console.warn("Worker returned error:", data.error);
        return fallback;
    }

    return data.text || fallback;
  } catch (error) {
    console.error("Analysis API error:", error);
    return fallback;
  }
};
