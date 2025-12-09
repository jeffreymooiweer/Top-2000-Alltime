// services/geminiService.ts
// Gebruikt Groq's OpenAI-compatibele Chat Completions API vanuit de browser.

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Snel én relatief goedkoop model
const GROQ_MODEL = "llama-3.1-8b-instant";

// ⚠️ LET OP: alles wat je hier invult is publiek zichtbaar in de browser.
// Gebruik bij voorkeur een key die je kunt weggooien en hou rekening met mogelijk misbruik.
const GROQ_API_KEY = "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"

export const getSongAnalysis = async (
  artist: string,
  title: string
): Promise<string> => {
  try {
    if (!GROQ_API_KEY || GROQ_API_KEY === "PLAATS_HIER_JE_GROQ_API_KEY") {
      console.warn("Groq API key is niet ingesteld.");
      return "Kon geen analyse laden op dit moment.";
    }

    const prompt =
      `Schrijf in het Nederlands een korte, enthousiaste uitleg (max 80 woorden) ` +
      `over waarom het nummer "${title}" van "${artist}" zo populair is in de Top 2000. ` +
      `Focus op emotie, nostalgie, mee-zingen of historische betekenis. En deel triviant weetjes over deze track.`;

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
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
      const errText = await response.text().catch(() => "");
      console.error("Groq API error status:", response.status, errText);
      return "Kon geen analyse laden op dit moment.";
    }

    const data: any = await response.json();

    const text =
      data?.choices?.[0]?.message?.content?.trim() ??
      data?.choices?.[0]?.message?.content ??
      "";

    if (!text) {
      return "Geen analyse beschikbaar.";
    }

    return text;
  } catch (error) {
    console.error("Groq API fout:", error);
    return "Kon geen analyse laden op dit moment.";
  }
};
