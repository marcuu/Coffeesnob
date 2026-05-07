import { z } from "zod";
import { parse as parseYaml } from "yaml";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const TasteVectorSchema = z.object({
  coffee_quality:    z.number().min(-1).max(1),
  roaster_purity:    z.number().min(-1).max(1),
  espresso_skill:    z.number().min(-1).max(1),
  manual_brew_skill: z.number().min(-1).max(1),
  vibe_modern:       z.number().min(-1).max(1),
  vibe_traditional:  z.number().min(-1).max(1),
  service_warmth:    z.number().min(-1).max(1),
  service_speed:     z.number().min(-1).max(1),
  value:             z.number().min(-1).max(1),
  tourist_density:   z.number().min(-1).max(1),
});

const CalibrationSchema = z.object({
  conformity:           z.number().min(0).max(1),
  noise:                z.number().min(0).max(1),
  pilgrimage_threshold: z.number().min(0).max(1),
  detour_threshold:     z.number().min(0).max(1),
});

const ActivitySchema = z.object({
  reviews_per_week_mean: z.number().positive(),
  reviews_per_week_sd:   z.number().min(0),
  reviews_per_session:   z.number().int().positive().default(1),
  active_days: z.array(
    z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  ),
});

export const PersonaSchema = z.object({
  id:            z.string(),
  name:          z.string(),
  handle:        z.string(),
  city:          z.string().default("bramford"),
  neighbourhood: z.string(),
  bio:           z.string(),
  voice_register: z.string(),
  taste_vector:  TasteVectorSchema,
  calibration:   CalibrationSchema,
  activity:      ActivitySchema,
});

export type Persona = z.infer<typeof PersonaSchema>;
export type TasteVector = z.infer<typeof TasteVectorSchema>;

export function loadPersona(filePath: string): Persona {
  const raw = readFileSync(filePath, "utf-8");
  return PersonaSchema.parse(parseYaml(raw));
}

export function loadAllPersonas(personasDir: string): Persona[] {
  return readdirSync(personasDir)
    .filter((f) => f.endsWith(".yaml") && f !== "README.yaml")
    .map((f) => loadPersona(join(personasDir, f)));
}
