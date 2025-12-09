export const getSongAnalysis = async (artist: string, title: string): Promise<string> => {
  try {
    const prompt = `
      Write a short, engaging paragraph (max 100 words) in Dutch explaining 
      why the song "${title}" by "${artist}" is so popular in the Top 2000.
      Focus on emotional impact, nostalgia, or cultural significance.
    `;

    const result = await google.ai.text.generate({
      model: "gemini-2.0-flash",
      prompt: prompt
    });

    return result.output_text || "Geen analyse beschikbaar.";
  } catch (error) {
    console.error("Gemini Keyless Error:", error);
    return "Kon geen analyse laden op dit moment.";
  }
};
