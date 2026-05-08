import type { Persona } from "./persona-loader";
import type { MappedScores } from "./bucket-mapping";

const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MODEL = "anthropic/claude-haiku-4-5";

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

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("AI_GATEWAY_API_KEY is required");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      // Noisier personas get slightly higher temperature for less predictable prose.
      temperature: Math.min(1.0, 0.75 + persona.calibration.noise * 0.5),
      messages: [
        { role: "system", content: buildSystem(persona) },
        { role: "user", content: buildPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI Gateway error ${res.status}: ${text}`);
  }

  const json = await res.json() as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const body = json.choices[0]?.message?.content?.trim() ?? "";

  return {
    body,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
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
