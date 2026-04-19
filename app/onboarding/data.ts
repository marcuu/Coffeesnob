// Onboarding domain types + pure ranking helpers.
// Venues are supplied at runtime (fetched from Supabase by the server page).

export type AxisKey =
  | "floral"
  | "fruit"
  | "choc"
  | "nutty"
  | "classic"
  | "spice";

export type Axes = Partial<Record<AxisKey, number>>;

export type DrinkId =
  | "espresso"
  | "filter"
  | "milky"
  | "cold"
  | "non_coffee"
  | "any";

export type Drink = { id: DrinkId; label: string };

export type FlavourOption = {
  id: string;
  name: string;
  notes: string;
  body: string;
  axes: Axes;
};

export type FlavourPair = {
  id: string;
  prompt: string;
  options: [FlavourOption, FlavourOption];
};

export type City = { id: string; name: string; venues: number };

export type OnboardingVenue = {
  slug: string;
  name: string;
  /** Human-readable city line (e.g. "London Fields"). */
  city: string;
  /** City id used for matching — lowercased DB city. */
  area: string;
  roaster: string;
  axes: Axes;
  drinks: DrinkId[];
  score: number;
  reviews: number;
  pitch: string;
  proof: string;
};

export type Prefs = {
  city: string;
  drink: DrinkId[];
  pairPicks: Record<string, string>;
  axes: Axes | null;
};

export const DRINKS: Drink[] = [
  { id: "espresso", label: "Espresso" },
  { id: "filter", label: "Filter" },
  { id: "milky", label: "Milk drinks" },
  { id: "cold", label: "Cold & iced" },
  { id: "non_coffee", label: "Non-coffee" },
  { id: "any", label: "All of it" },
];

export const FLAVOUR_PAIRS: FlavourPair[] = [
  {
    id: "round1",
    prompt: "Which sounds more like your dream cup?",
    options: [
      {
        id: "yirg",
        name: "Ethiopian Yirgacheffe",
        notes: "Jasmine · lemon · bergamot",
        body: "Tea-like body. Tastes like a garden.",
        axes: { floral: 1, fruit: 0.6 },
      },
      {
        id: "brazil",
        name: "Brazilian Fazenda",
        notes: "Cocoa · walnut · brown sugar",
        body: "Round, heavy body. Tastes like a hug.",
        axes: { choc: 1, nutty: 0.8 },
      },
    ],
  },
  {
    id: "round2",
    prompt: "Pick the one you'd order tomorrow.",
    options: [
      {
        id: "kenya",
        name: "Kenyan washed",
        notes: "Blackcurrant · tomato leaf · red wine",
        body: "Sharp, juicy, makes you sit up.",
        axes: { fruit: 1, floral: 0.3 },
      },
      {
        id: "colombia",
        name: "Colombian classic",
        notes: "Caramel · apple · milk chocolate",
        body: "Balanced, sweet, no surprises.",
        axes: { classic: 1, choc: 0.5 },
      },
    ],
  },
  {
    id: "round3",
    prompt: "Last one. Weird, or reliable?",
    options: [
      {
        id: "natural",
        name: "Natural Ethiopia",
        notes: "Strawberry jam · clove · cedar",
        body: "Funky, fermented, unlike anything else.",
        axes: { fruit: 0.7, spice: 1 },
      },
      {
        id: "house",
        name: "House blend, flat white",
        notes: "Roasted nut · toffee · malt",
        body: "The coffee you can order with your eyes closed.",
        axes: { nutty: 1, classic: 0.7 },
      },
    ],
  },
];

export function drinkLabel(id: string): string {
  const map: Record<string, string> = {
    espresso: "espresso",
    filter: "filter",
    milky: "milk drinks",
    cold: "cold brew",
    non_coffee: "non-coffee",
    any: "anything",
  };
  return map[id] ?? id;
}

export type RankedVenue = OnboardingVenue & { _s: number; match: number };

export function scoreVenueFor(v: OnboardingVenue, prefs: Prefs): number {
  let s = 0;
  if (prefs.axes) {
    for (const k in v.axes) {
      const key = k as AxisKey;
      s += (prefs.axes[key] || 0) * (v.axes[key] || 0) * 3;
    }
  }
  if (prefs.drink && prefs.drink.length) {
    v.drinks.forEach((d) => {
      if (prefs.drink.includes(d) || prefs.drink.includes("any")) s += 1.5;
    });
  }
  if (prefs.city && v.area === prefs.city) s += 4;
  s += v.score / 10;
  return s;
}

export function confidenceFor(v: OnboardingVenue, prefs: Prefs): number {
  let c = 62;
  if (prefs.axes) {
    const shared = (Object.keys(v.axes) as AxisKey[]).filter(
      (k) => (prefs.axes?.[k] || 0) > 0.2,
    ).length;
    c += shared * 6;
  }
  if (
    prefs.drink &&
    prefs.drink.some((d) => v.drinks.includes(d) || d === "any")
  ) {
    c += 5;
  }
  if (prefs.city && v.area === prefs.city) c += 6;
  return Math.min(97, c);
}

export function rankVenues(
  venues: OnboardingVenue[],
  prefs: Prefs,
): RankedVenue[] {
  const scored: RankedVenue[] = venues.map((v) => ({
    ...v,
    _s: scoreVenueFor(v, prefs),
    match: confidenceFor(v, prefs),
  }));
  scored.sort((a, b) => b._s - a._s);
  return scored;
}

export function reasonsFor(
  v: OnboardingVenue,
  prefs: Prefs,
  cities: City[],
): string[] {
  const r: string[] = [];
  if (prefs.city && v.area === prefs.city) {
    const c = cities.find((c) => c.id === prefs.city);
    r.push(`in ${c ? c.name : "your city"}`);
  }
  if (prefs.axes) {
    const top = Object.entries(prefs.axes).sort(
      (a, b) => (b[1] || 0) - (a[1] || 0),
    )[0];
    if (top) {
      const key = top[0] as AxisKey;
      if ((v.axes[key] || 0) >= 0.6) {
        r.push(`strong on ${key}`);
      }
    }
  }
  if (prefs.drink && prefs.drink.length) {
    const match = v.drinks.find((d) => prefs.drink.includes(d));
    if (match) r.push(`great for ${drinkLabel(match)}`);
  }
  if (r.length === 0) r.push("community favourite");
  return r;
}
