import type { Persona, VenueSeed } from "./types";

export type ReviewWriterInput = {
  persona: Persona;
  venue: Pick<VenueSeed, "name" | "category" | "neighbourhood" | "prompt_description">;
  bucket: "pilgrimage" | "detour" | "convenience";
  ratingCoffee5: number;
  ratingVibe5: number;
  currentObsession?: string | null;
};

export type ReviewWriterOutput = {
  body: string;
  promptTokens: number;
  completionTokens: number;
  modelId: string;
  costUsd: number;
};

const DEFAULT_MODEL = "claude-sonnet-4-6";
const INPUT_PER_MILLION = 3;
const OUTPUT_PER_MILLION = 15;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function cost(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1_000_000) * INPUT_PER_MILLION + (completionTokens / 1_000_000) * OUTPUT_PER_MILLION;
}

function fallbackReview(input: ReviewWriterInput): string {
  const verdict =
    input.bucket === "pilgrimage"
      ? "worth crossing Bramford for"
      : input.bucket === "detour"
        ? "worth a deliberate detour"
        : "fine when you are already nearby";
  return `${input.venue.name} is ${verdict}. Coffee ${input.ratingCoffee5}/5, vibe ${input.ratingVibe5}/5. ${input.persona.voice_register.split(".")[0]}. ${input.venue.prompt_description}`;
}

export async function writeReview(input: ReviewWriterInput): Promise<ReviewWriterOutput> {
  const modelId = process.env.SIMULATION_MODEL ?? DEFAULT_MODEL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const prompt = [
    `Persona: ${input.persona.name} ${input.persona.handle}`,
    `Bio: ${input.persona.bio}`,
    `Voice: ${input.persona.voice_register}`,
    `Venue: ${input.venue.name}, ${input.venue.neighbourhood}, ${input.venue.category}`,
    `Venue truth: ${input.venue.prompt_description}`,
    `Bucket: ${input.bucket}`,
    `Scores: coffee ${input.ratingCoffee5}/5, vibe ${input.ratingVibe5}/5`,
    input.currentObsession ? `Current obsession: ${input.currentObsession}` : "",
    "Write one 80-200 word Coffeesnob review. Do not mention being an AI or calibration panel.",
  ]
    .filter(Boolean)
    .join("\n");

  if (!apiKey) {
    const body = fallbackReview(input);
    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(body);
    return { body, promptTokens, completionTokens, modelId: "fallback-local", costUsd: 0 };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 320,
      temperature: 0.85,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    if (process.env.SIMULATION_REQUIRE_LLM === "true") {
      throw new Error(`Anthropic review generation failed: ${res.status}`);
    }
    const body = fallbackReview(input);
    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(body);
    return { body, promptTokens, completionTokens, modelId: "fallback-local", costUsd: 0 };
  }

  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const body = json.content?.find((part) => part.type === "text")?.text?.trim() || fallbackReview(input);
  const promptTokens = json.usage?.input_tokens ?? estimateTokens(prompt);
  const completionTokens = json.usage?.output_tokens ?? estimateTokens(body);
  return { body, promptTokens, completionTokens, modelId, costUsd: cost(promptTokens, completionTokens) };
}
