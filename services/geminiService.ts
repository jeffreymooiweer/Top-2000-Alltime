// services/geminiService.ts
import * as webllm from "@mlc-ai/web-llm";

const MODEL_NAME = "SmolLM2-360M-Instruct-q4f16_1-MLC";

// Zorg dat het model maar één keer per tab wordt geladen
let enginePromise: Promise<webllm.MLCEngine> | null = null;

async function getEngine(): Promise<webllm.MLCEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      console.log("WebLLM: model wordt geladen:", MODEL_NAME);
      const engine = await webllm.CreateMLCEngine(MODEL_NAME, {
        initProgressCallback: (report) => {
          console.log(
            "WebLLM laadvoortgang:",
            report.progress,
            report.text ?? ""
          );
        },
      });
      console.log("WebLLM klaar");
      return engine;
    })();
  }
  return enginePromise;
}

export const getSongAnalysis = async (
  artist: string,
  title: string
): Promise<string> => {
  try {
    const engine = await getEngine();

    const messages: webllm.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "Je bent een Nederlandse muziekjournalist die korte, enthousiaste teksten schrijft over nummers uit de Top 2000.",
      },
      {
        role: "user",
        content:
          `Schrijf maximaal 80 woorden in het Nederlands over waarom het nummer ` +
          `"${title}" van "${artist}" zo geliefd is in de Top 2000. ` +
          `Focus op emotie, nostalgie of culturele betekenis.`,
      },
    ];

    const reply = await engine.chat.completions.create({
      messages,
      temperature: 0.8,
      max_tokens: 120,
    });

    const text = reply.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return "Geen analyse beschikbaar.";
    }
    return text;
  } catch (error) {
    console.error("WebLLM Error:", error);
    return "Kon geen analyse laden op dit moment.";
  }
};
