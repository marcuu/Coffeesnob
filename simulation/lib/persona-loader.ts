import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { buildDefaultPersonas, buildDefaultVenues } from "./catalog";
import { personaSchema, venueSeedSchema, type Persona, type VenueSeed } from "./types";

function readJsonSubset<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8").trim();
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export function loadPersonas(root = process.cwd()): Persona[] {
  const dir = join(root, "simulation", "personas");
  const defaults = buildDefaultPersonas();
  if (!existsSync(dir)) return defaults;

  const loaded = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".json"))
    .flatMap((file) => {
      const parsed = readJsonSubset<{ personas?: unknown[] } | unknown[]>(join(dir, file));
      if (!parsed) return [];
      return Array.isArray(parsed) ? parsed : parsed.personas ?? [];
    })
    .map((p) => personaSchema.parse(p));

  return loaded.length > 0 ? loaded : defaults;
}

export function loadBramfordVenues(root = process.cwd()): VenueSeed[] {
  const file = join(root, "simulation", "venues", "bramford-seed.yaml");
  const parsed = readJsonSubset<{ venues?: unknown[] } | unknown[]>(file);
  const raw = parsed ? (Array.isArray(parsed) ? parsed : parsed.venues ?? []) : [];
  const loaded = raw.map((v) => venueSeedSchema.parse(v));
  return loaded.length > 0 ? loaded : buildDefaultVenues();
}

export function personaToFrozenYaml(persona: Persona): string {
  return JSON.stringify(persona, null, 2);
}
