import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Persona } from "./persona-loader";
import type { MappedScores } from "./bucket-mapping";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) throw new Error("GOOGLE_API_KEY is required");

const genAI = new GoogleGenerativeAI(apiKey);

const MODEL = "gemini-3-flash";

export type ReviewWriterInput = {
  persona: Persona;
  venueName: string;
  venueDescription: string;
  neighbourhood: string;
  scores: MappedScores;
  currentObsession: string | null;
  recentSnippets: string[];
};

export type ReviewWriterOutput = {
  body: string;
  promptTokens: number;
  completionTokens: number;
};

export async function writeReview(
  input: ReviewWriterInput,
): Promise<ReviewWriterOutput> {
  const { persona } = input;

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: buildSystem(persona),
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
    generationConfig: {
      maxOutputTokens: 400,
      // Noisier personas get slightly higher temperature for less predictable prose.
      temperature: Math.min(1.0, 0.75 + persona.calibration.noise * 0.5),
    },
  });

  const body = result.response.text().trim();
  const usage = result.response.usageMetadata;

  return {
    body,
    promptTokens: usage?.promptTokenCount ?? 0,
    completionTokens: usage?.candidatesTokenCount ?? 0,
  };
}

function buildSystem(persona: Persona): string {
  return (
    `You are ${persona.name} (${persona.handle}), a coffee reviewer in the fictional city of Bramford. ` +
    `Write ONLY the review body — no preamble, no "Here is my review:", no surrounding quotes. ` +
    `Match the voice register exactly. ` +
    `Length: 60–220 words. Do not introduce facts not given to you.`
  );
}

function buildPrompt(input: ReviewWriterInput): string {
  const { persona, venueName, venueDescription, neighbourhood, scores, currentObsession, recentSnippets } = input;

  const bucketLabel =
    scores.bucket === "pilgrimage"
      ? "one of your best — a genuine pilgrimage"
      : scores.bucket === "detour"
      ? "worth a detour"
      : "convenient but unremarkable";

  const lines: string[] = [
    `About you:`,
    persona.bio.trim(),
    ``,
    `Your voice:`,
    persona.voice_register.trim(),
    ``,
    `Venue: ${venueName}, ${neighbourhood}, Bramford`,
    `Venue description:`,
    venueDescription.trim(),
    ``,
    `Your honest assessment: this place is ${bucketLabel}.`,
    `Coffee score: ${scores.coffee_5}/5. Vibe score: ${scores.vibe_5}/5.`,
  ];

  if (currentObsession) {
    lines.push(``, `You are currently thinking a lot about: ${currentObsession}`);
  }

  if (recentSnippets.length > 0) {
    lines.push(
      ``,
      `Recent snippets from your own reviews (for voice consistency only — do not reference these venues):`,
      ...recentSnippets.map((s) => `"${s.slice(0, 150)}"`),
    );
  }

  lines.push(``, `Write your review of ${venueName}.`);
  return lines.join("\n");
}
