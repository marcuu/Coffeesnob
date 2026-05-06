import type { AttributeKey, AttributeVector, Persona, VenueSeed } from "./types";

const NEIGHBOURHOODS = ["harbourside", "the-quarter", "north-bank", "old-town", "university-park"];
const DAYSETS = [
  ["mon", "tue", "wed", "thu", "fri"],
  ["wed", "thu", "fri", "sat", "sun"],
  ["mon", "wed", "fri", "sat"],
] as const;

type PersonaTemplate = {
  label: string;
  count: number;
  taste: Partial<AttributeVector>;
  voice: string;
  thresholdShift?: number;
  noise?: number;
  conformity?: number;
};

const BASE_TASTE: AttributeVector = {
  coffee_quality: 0.7,
  roaster_purity: 0.45,
  espresso_skill: 0.55,
  manual_brew_skill: 0.45,
  vibe_modern: 0.35,
  vibe_traditional: 0.35,
  service_warmth: 0.45,
  service_speed: 0.35,
  value: 0.35,
  tourist_density: -0.25,
};

const PERSONA_TEMPLATES: PersonaTemplate[] = [
  { label: "snob-purist", count: 12, taste: { coffee_quality: 0.98, roaster_purity: 0.9, manual_brew_skill: 0.82, vibe_modern: 0.1, vibe_traditional: 0.7, tourist_density: -0.85 }, voice: "Wry, exacting, allergic to hype. Technical but not performative.", thresholdShift: 0.08, noise: 0.12, conformity: 0.35 },
  { label: "modern-third-wave", count: 8, taste: { coffee_quality: 0.86, roaster_purity: 0.72, manual_brew_skill: 0.7, vibe_modern: 0.82, service_warmth: 0.55, tourist_density: -0.35 }, voice: "Bright, design-aware, enthusiastic when the room and cup cohere.", noise: 0.16, conformity: 0.55 },
  { label: "italian-espresso", count: 7, taste: { espresso_skill: 0.95, vibe_traditional: 0.78, service_speed: 0.66, manual_brew_skill: 0.1, vibe_modern: 0.1, tourist_density: -0.25 }, voice: "Short, dry, espresso-led. Distrusts elaborate brew theatre.", noise: 0.15, conformity: 0.45 },
  { label: "barista-insider", count: 6, taste: { coffee_quality: 0.92, espresso_skill: 0.82, manual_brew_skill: 0.78, service_warmth: 0.25, value: 0.25, tourist_density: -0.7 }, voice: "Industry-literate, quietly severe, notices workflow and extraction.", noise: 0.1, conformity: 0.4 },
  { label: "milk-drink", count: 5, taste: { espresso_skill: 0.72, vibe_modern: 0.64, service_warmth: 0.78, service_speed: 0.54, value: 0.58, roaster_purity: 0.2 }, voice: "Warm, sensory, attentive to milk texture and whether the room is kind.", noise: 0.2, conformity: 0.65 },
  { label: "casual-curious", count: 5, taste: { coffee_quality: 0.55, vibe_modern: 0.55, service_warmth: 0.72, service_speed: 0.65, value: 0.7, tourist_density: 0.1 }, voice: "Plain-spoken, curious, useful rather than doctrinaire.", thresholdShift: -0.08, noise: 0.24, conformity: 0.75 },
  { label: "contrarian", count: 4, taste: { coffee_quality: 0.62, roaster_purity: -0.35, vibe_modern: -0.25, service_warmth: 0.55, tourist_density: 0.35, value: 0.72 }, voice: "Contrarian, funny, suspicious of consensus favourites.", thresholdShift: -0.03, noise: 0.22, conformity: 0.05 },
  { label: "noisy", count: 3, taste: { coffee_quality: 0.5, vibe_modern: 0.5, service_warmth: 0.5, value: 0.5, tourist_density: 0.0 }, voice: "Variable, impulsive, mood-coloured; occasionally very sharp.", thresholdShift: -0.12, noise: 0.48, conformity: 0.5 },
];

const FIRST = ["Eliza", "Mara", "Theo", "Nina", "Oscar", "Priya", "Jonas", "Mae", "Felix", "Clara"];
const LAST = ["Blackwood", "Vale", "Arden", "Sayer", "Bell", "Rowe", "Keane", "March", "Ellis", "Stone"];

function taste(overrides: Partial<AttributeVector>, i: number): AttributeVector {
  const out = { ...BASE_TASTE, ...overrides };
  for (const key of Object.keys(out) as AttributeKey[]) {
    out[key] = Math.max(-1, Math.min(1, out[key] + ((i % 5) - 2) * 0.025));
  }
  return out;
}

export function buildDefaultPersonas(): Persona[] {
  const personas: Persona[] = [];
  let n = 0;
  for (const template of PERSONA_TEMPLATES) {
    for (let i = 0; i < template.count; i++) {
      const first = FIRST[n % FIRST.length];
      const last = LAST[(n * 3) % LAST.length];
      const id = `bramford-${first.toLowerCase()}-${last.toLowerCase()}-${n + 1}`;
      const neighbourhood = NEIGHBOURHOODS[n % NEIGHBOURHOODS.length];
      personas.push({
        id,
        name: `${first} ${last}`,
        handle: `@${first.toLowerCase()}${last.toLowerCase()}${n + 1}`,
        city: "bramford",
        neighbourhood,
        bio: `${template.label.replace(/-/g, " ")} from ${neighbourhood}. Part of Coffeesnob's Bramford calibration panel.`,
        voice_register: template.voice,
        taste_vector: taste(template.taste, n),
        calibration: {
          conformity: template.conformity ?? 0.5,
          noise: template.noise ?? 0.18,
          pilgrimage_threshold: 0.74 + (template.thresholdShift ?? 0),
          detour_threshold: 0.43 + (template.thresholdShift ?? 0) / 2,
        },
        activity: {
          reviews_per_week_mean: 2.5 + ((n % 5) - 2) * 0.15,
          reviews_per_week_sd: 0.8 + (n % 3) * 0.15,
          reviews_per_session: 1,
          active_days: [...DAYSETS[n % DAYSETS.length]],
        },
      });
      n++;
    }
  }
  return personas;
}

const VENUE_NAMES = [
  "Driftwood", "The Bench", "Ravelin & Co", "Low Tide", "Kestrel", "Glasshouse", "Tandem", "Black Buoy",
  "Still Room", "Port Ledger", "Assembly Yard", "Milkline", "The Copper Spoon", "North Light", "Hearth", "Civic",
  "Salt Arcade", "Pennyweight", "Crescent Bar", "Signal House", "Grey Sail", "Plot 14", "Mica", "Foundry",
  "Docket", "Murmur", "The Little Boiler", "August Room", "Seawall", "Kiosk 9", "Bridge End", "Faculty",
  "The Atrium", "Fennel", "Bram & Sons", "Old Pier Cafe", "Station Cup", "Market Nero", "Bean Parade", "Harbour Roast",
];

const CATEGORIES = ["classic", "solid", "divisive", "disliked", "rising"] as const;

type VenueCategory = (typeof CATEGORIES)[number];

const CATEGORY_VECTOR: Record<VenueCategory, Partial<AttributeVector>> = {
  classic: { coffee_quality: 0.92, roaster_purity: 0.82, espresso_skill: 0.82, manual_brew_skill: 0.82, service_warmth: 0.55, tourist_density: -0.45, value: 0.48 },
  solid: { coffee_quality: 0.72, roaster_purity: 0.55, espresso_skill: 0.65, manual_brew_skill: 0.52, service_warmth: 0.62, service_speed: 0.58, value: 0.62 },
  divisive: { coffee_quality: 0.78, roaster_purity: 0.88, espresso_skill: 0.55, manual_brew_skill: 0.9, service_warmth: 0.22, service_speed: 0.18, value: 0.28, vibe_modern: 0.72, tourist_density: -0.7 },
  disliked: { coffee_quality: 0.22, roaster_purity: 0.05, espresso_skill: 0.25, manual_brew_skill: 0.08, vibe_modern: 0.38, service_warmth: 0.35, service_speed: 0.82, value: 0.28, tourist_density: 0.82 },
  rising: { coffee_quality: 0.7, roaster_purity: 0.68, espresso_skill: 0.62, manual_brew_skill: 0.62, vibe_modern: 0.78, service_warmth: 0.68, value: 0.58, tourist_density: -0.2 },
};

function venueCategory(i: number): VenueCategory {
  if (i < 10) return "classic";
  if (i < 25) return "solid";
  if (i < 45) return "divisive";
  if (i < 60) return "disliked";
  return "rising";
}

export function buildDefaultVenues(): VenueSeed[] {
  return Array.from({ length: 80 }, (_, i) => {
    const category = venueCategory(i);
    const baseName = VENUE_NAMES[i % VENUE_NAMES.length];
    const name = i < VENUE_NAMES.length ? baseName : `${baseName} ${i + 1}`;
    const neighbourhood = NEIGHBOURHOODS[i % NEIGHBOURHOODS.length];
    const vector = taste(CATEGORY_VECTOR[category], i);
    return {
      slug: `bramford-${name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      name,
      neighbourhood,
      category,
      address_line1: `${10 + i} ${neighbourhood.replace(/-/g, " ")} lane`,
      postcode: `BF${1 + (i % 9)} ${i % 10}SN`,
      roasters: category === "disliked" ? [] : [`${name.split(" ")[0]} Roasting`],
      brew_methods: category === "divisive" ? ["filter", "pour_over", "aeropress"] : ["espresso", "filter", "batch_brew"],
      has_decaf: category !== "divisive",
      has_plant_milk: true,
      prompt_description: `${name} is a ${category} Bramford cafe in ${neighbourhood}. It is fictional and part of the Coffeesnob calibration simulation.`,
      attribute_vector: vector,
    };
  });
}
