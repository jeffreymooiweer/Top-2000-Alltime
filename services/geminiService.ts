

export const getSongAnalysis = async (artist: string, title: string): Promise<string> => {
  try {
    const prompt = `
      Write a short, engaging paragraph (max 100 words) in Dutch explaining why the song "${title}" by "${artist}" is so popular in the Top 2000.    Focus on its emotional impact or historical significance.    Keep the tone appreciative and suitable for a music radio fan.
    `;

    const result = await google.ai.text.generate({
      model: "models/gemini-2.0-flash",
      prompt: prompt
    });

    // Nieuwe API levert result.output_text
    return result.output_text || "Geen analyse beschikbaar.";
  } catch (error) {
    console.error("Gemini Keyless Error:", error);
    return "Kon geen analyse laden op dit moment.";
  }
};
