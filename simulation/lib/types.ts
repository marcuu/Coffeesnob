import { z } from "zod";

export const ATTRIBUTE_KEYS = [
  "coffee_quality",
  "roaster_purity",
  "espresso_skill",
  "manual_brew_skill",
  "vibe_modern",
  "vibe_traditional",
  "service_warmth",
  "service_speed",
  "value",
  "tourist_density",
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type AttributeVector = Record<AttributeKey, number>;

const vectorSchema = z.object(
  Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, z.number().min(-1).max(1)])) as Record<
    AttributeKey,
    z.ZodNumber
  >,
);

export const personaSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(1),
  handle: z.string().min(2),
  city: z.literal("bramford"),
  neighbourhood: z.string().min(1),
  bio: z.string().min(1),
  voice_register: z.string().min(1),
  taste_vector: vectorSchema,
  calibration: z.object({
    conformity: z.number().min(0).max(1),
    noise: z.number().min(0).max(1),
    pilgrimage_threshold: z.number().min(-1).max(1.5),
    detour_threshold: z.number().min(-1).max(1.5),
  }),
  activity: z.object({
    reviews_per_week_mean: z.number().min(0),
    reviews_per_week_sd: z.number().min(0),
    reviews_per_session: z.number().int().min(1).max(3),
    active_days: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])),
  }),
});

export type Persona = z.infer<typeof personaSchema>;

export const venueSeedSchema = z.object({
  slug: z.string().min(2),
  name: z.string().min(1),
  neighbourhood: z.string().min(1),
  category: z.string().min(1),
  address_line1: z.string().min(1),
  postcode: z.string().min(2),
  roasters: z.array(z.string()),
  brew_methods: z.array(z.enum(["espresso", "filter", "pour_over", "batch_brew", "aeropress", "cold_brew"])),
  has_decaf: z.boolean(),
  has_plant_milk: z.boolean(),
  prompt_description: z.string().min(1),
  attribute_vector: vectorSchema,
});

export type VenueSeed = z.infer<typeof venueSeedSchema>;

export type SimulationReviewPlan = {
  reviewerId: string;
  persona: Persona;
  venueId: string;
  venueSlug: string;
  preference: number;
  bucket: "pilgrimage" | "detour" | "convenience";
  rating_coffee_5: number;
  rating_vibe_5: number;
  body: string;
  promptTokens: number;
  completionTokens: number;
  modelId: string;
};
