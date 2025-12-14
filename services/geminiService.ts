import { API_BASE } from './config';

// Snel én relatief goedkoop model
const GROQ_MODEL = "llama-3.1-8b-instant";

const getFallbackAnalysis = (artist: string, title: string) => {
    return `"${title}" van ${artist} is een vaste waarde in de Top 2000. Het nummer roept bij veel luisteraars nostalgische gevoelens op en wordt jaarlijks door duizenden mensen gekozen als een van de beste nummers aller tijden.`;
};

export const getSongAnalysis = async (
  artist: string,
  title: string
): Promise<string> => {
  const fallback = getFallbackAnalysis(artist, title);

  try {
    const prompt =
      `Schrijf in het Nederlands een korte, enthousiaste uitleg (max 80 woorden) ` +
      `over waarom het nummer "${title}" van "${artist}" zo populair is in de Top 2000. ` +
      `Focus op emotie, nostalgie, mee-zingen of historische betekenis. En deel triviant weetjes over deze track.`;

    const response = await fetch(`${API_BASE}/ai/groq`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Je bent een Nederlandse muziekjournalist die korte, vlotte teksten schrijft over Top 2000-nummers.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      console.error("Backend AI error status:", response.status);
      return fallback;
    }

    const data: any = await response.json();

    const text =
      data?.choices?.[0]?.message?.content?.trim() ??
      data?.choices?.[0]?.message?.content ??
      "";

    if (!text) {
      return fallback;
    }

    return text;
  } catch (error) {
    console.error("Backend AI fout:", error);
    return fallback;
  }
};
