import { describe, expect, it } from "vitest";
import {
  mapPreferenceToBucket,
  mapPreferenceToScores,
} from "../../simulation/lib/bucket-mapping";
import type { Persona } from "../../simulation/lib/persona-loader";
import type { AttributeVector } from "../../simulation/lib/preference";

// Minimal persona fixture.
const persona: Persona = {
  id: "test-persona",
  name: "Test",
  handle: "@test",
  city: "bramford",
  neighbourhood: "harbourside",
  bio: "test",
  voice_register: "test",
  taste_vector: {
    coffee_quality:    0.80,
    roaster_purity:    0.70,
    espresso_skill:    0.60,
    manual_brew_skill: 0.75,
    vibe_modern:       0.50,
    vibe_traditional:  0.50,
    service_warmth:    0.50,
    service_speed:     0.50,
    value:             0.50,
    tourist_density:  -0.50,
  },
  calibration: {
    conformity:           0.30,
    noise:                0.15,
    pilgrimage_threshold: 0.80,
    detour_threshold:     0.45,
  },
  activity: {
    reviews_per_week_mean: 2.0,
    reviews_per_week_sd:   1.0,
    reviews_per_session:   1,
    active_days: ["mon", "tue", "wed", "thu", "fri"],
  },
};

const attrHigh: AttributeVector = {
  coffee_quality:    0.95, roaster_purity: 0.90, espresso_skill: 0.85,
  manual_brew_skill: 0.92, vibe_modern: 0.50, vibe_traditional: 0.70,
  service_warmth: 0.60, service_speed: 0.50, value: 0.60, tourist_density: 0.15,
};

const attrMid: AttributeVector = {
  coffee_quality:    0.60, roaster_purity: 0.50, espresso_skill: 0.55,
  manual_brew_skill: 0.50, vibe_modern: 0.60, vibe_traditional: 0.55,
  service_warmth: 0.70, service_speed: 0.65, value: 0.70, tourist_density: 0.40,
};

const attrPoor: AttributeVector = {
  coffee_quality:    0.15, roaster_purity: 0.05, espresso_skill: 0.20,
  manual_brew_skill: 0.00, vibe_modern: 0.45, vibe_traditional: 0.30,
  service_warmth: 0.55, service_speed: 0.70, value: 0.25, tourist_density: 0.90,
};

describe("mapPreferenceToBucket", () => {
  it("maps high preference to pilgrimage", () => {
    // Preference near 1.0 → shifted near 1.0 → above 0.80 threshold
    expect(mapPreferenceToBucket(0.70, persona)).toBe("pilgrimage");
  });

  it("maps medium preference to detour", () => {
    expect(mapPreferenceToBucket(0.00, persona)).toBe("detour");
  });

  it("maps low preference to convenience", () => {
    expect(mapPreferenceToBucket(-0.50, persona)).toBe("convenience");
  });

  it("threshold edge: exactly at pilgrimage_threshold maps to pilgrimage", () => {
    // threshold = 0.80 → raw preference = 0.60 (shifted from [0,1])
    const p = persona.calibration.pilgrimage_threshold * 2 - 1; // = 0.60
    expect(mapPreferenceToBucket(p, persona)).toBe("pilgrimage");
  });
});

describe("mapPreferenceToScores", () => {
  it("coffee_5 and vibe_5 are integers in [1,5]", () => {
    for (const attr of [attrHigh, attrMid, attrPoor]) {
      const pref = 0.1;
      const bucket = mapPreferenceToBucket(pref, persona);
      const scores = mapPreferenceToScores(pref, bucket, persona, attr);
      expect(scores.coffee_5).toBeGreaterThanOrEqual(1);
      expect(scores.coffee_5).toBeLessThanOrEqual(5);
      expect(scores.vibe_5).toBeGreaterThanOrEqual(1);
      expect(scores.vibe_5).toBeLessThanOrEqual(5);
      expect(Number.isInteger(scores.coffee_5)).toBe(true);
      expect(Number.isInteger(scores.vibe_5)).toBe(true);
    }
  });

  it("pilgrimage bucket produces coffee_5 >= 3", () => {
    const scores = mapPreferenceToScores(0.70, "pilgrimage", persona, attrHigh);
    expect(scores.coffee_5).toBeGreaterThanOrEqual(3);
  });

  it("convenience bucket produces coffee_5 <= 4", () => {
    const scores = mapPreferenceToScores(-0.70, "convenience", persona, attrPoor);
    expect(scores.coffee_5).toBeLessThanOrEqual(4);
  });
});
