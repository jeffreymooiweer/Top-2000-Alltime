import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getSongAnalysis = async (artist: string, title: string): Promise<string> => {
  try {
    const prompt = `
      Write a short, engaging paragraph (max 100 words) in Dutch explaining why the song "${title}" by "${artist}" is so popular in the Top 2000. 
      Focus on its emotional impact or historical significance. 
      Keep the tone appreciative and suitable for a music radio fan.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Geen analyse beschikbaar.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Kon geen analyse laden op dit moment.";
  }
};
