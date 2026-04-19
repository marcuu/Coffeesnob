// v2 data — anchored flavour pairs, concrete examples, no level question.

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

export type Venue = {
  slug: string;
  name: string;
  city: string;
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

export const CITIES: City[] = [
  { id: "london", name: "London", venues: 128 },
  { id: "manchester", name: "Manchester", venues: 41 },
  { id: "leeds", name: "Leeds", venues: 29 },
  { id: "bristol", name: "Bristol", venues: 34 },
  { id: "brighton", name: "Brighton", venues: 22 },
  { id: "bath", name: "Bath", venues: 14 },
  { id: "edinburgh", name: "Edinburgh", venues: 26 },
  { id: "glasgow", name: "Glasgow", venues: 24 },
];

export const VENUES: Venue[] = [
  {
    slug: "la-cabra",
    name: "La Cabra",
    city: "London Fields",
    area: "london",
    roaster: "La Cabra (DK)",
    axes: { floral: 0.9, fruit: 0.8 },
    drinks: ["filter", "espresso"],
    score: 8.9,
    reviews: 47,
    pitch:
      "The Geisha filter tastes like jasmine tea gatecrashed an orange grove.",
    proof: "Last 20 filter reviews: 9.1 avg on 'floral', 8.8 on 'clarity'.",
  },
  {
    slug: "prufrock",
    name: "Prufrock",
    city: "Leather Lane, EC1",
    area: "london",
    roaster: "Square Mile",
    axes: { fruit: 0.9, floral: 0.6, classic: 0.5 },
    drinks: ["filter", "espresso"],
    score: 8.7,
    reviews: 118,
    pitch: "A washed Kenyan that drinks like blackcurrant cordial. Still.",
    proof: "Top-rated third-wave venue in EC1 for the last 18 months.",
  },
  {
    slug: "kaffeine",
    name: "Kaffeine",
    city: "Fitzrovia",
    area: "london",
    roaster: "Workshop",
    axes: { choc: 0.8, nutty: 0.7, classic: 0.9 },
    drinks: ["milky", "espresso"],
    score: 8.4,
    reviews: 204,
    pitch: "Flat white benchmark. The texture is silk.",
    proof: "Milk drink reviews: 8.9 avg on 'texture', highest in London.",
  },
  {
    slug: "north-star",
    name: "North Star",
    city: "Leeds",
    area: "leeds",
    roaster: "North Star",
    axes: { choc: 0.9, nutty: 0.8, classic: 0.7 },
    drinks: ["milky", "espresso", "cold"],
    score: 8.2,
    reviews: 88,
    pitch: "Cortado with cocoa and hazelnut. A proper hug in a cup.",
    proof: "Leeds' #1 for milk drinks, 3 years running.",
  },
  {
    slug: "colonna",
    name: "Colonna & Small's",
    city: "Bath",
    area: "bath",
    roaster: "Colonna",
    axes: { fruit: 1, floral: 0.7, spice: 0.6 },
    drinks: ["cold", "filter"],
    score: 8.8,
    reviews: 63,
    pitch:
      "Maxwell Colonna-Dashwood's lab. Cold brew from another planet.",
    proof: "Highest-rated experimental brews on Coffeesnob.",
  },
  {
    slug: "blossom",
    name: "Blossom Coffee Brewers",
    city: "Manchester",
    area: "manchester",
    roaster: "Heart & Graft",
    axes: { floral: 0.7, classic: 0.8 },
    drinks: ["non_coffee", "milky"],
    score: 8.1,
    reviews: 42,
    pitch: "Ceremonial matcha next to a flat white that holds its own.",
    proof: "Only venue in MCR scoring 8+ on both coffee and matcha.",
  },
  {
    slug: "laynes",
    name: "Laynes Espresso",
    city: "Leeds",
    area: "leeds",
    roaster: "Square Mile",
    axes: { classic: 1, choc: 0.6 },
    drinks: ["milky", "espresso"],
    score: 8.3,
    reviews: 76,
    pitch: "A neighbourhood anchor. Do the cortado.",
    proof: "Most-reviewed venue outside London.",
  },
  {
    slug: "machina",
    name: "Machina Coffee",
    city: "Leeds",
    area: "leeds",
    roaster: "Friends of Ham",
    axes: { fruit: 0.7, classic: 0.6, choc: 0.4 },
    drinks: ["espresso", "milky"],
    score: 8.0,
    reviews: 54,
    pitch: "Weekly-rotating single origins, no attitude about it.",
    proof: "Consistent 8+ on 'value' across 50+ reviews.",
  },
  {
    slug: "curators",
    name: "Curators Coffee",
    city: "Margaret St, W1",
    area: "london",
    roaster: "Nude",
    axes: { spice: 1, fruit: 0.7 },
    drinks: ["filter", "espresso"],
    score: 8.0,
    reviews: 31,
    pitch: "Natural Ethiopians with clove on the finish. Unusual, correct.",
    proof:
      "Only venue rated 9+ on 'adventurous sourcing' by expert reviewers.",
  },
  {
    slug: "artisan-r",
    name: "Artisan Roast",
    city: "Edinburgh",
    area: "edinburgh",
    roaster: "Artisan",
    axes: { choc: 0.7, nutty: 0.6, classic: 0.8 },
    drinks: ["milky", "espresso"],
    score: 8.5,
    reviews: 69,
    pitch:
      "Edinburgh's oldest third-wave anchor. Flat white benchmark north of the border.",
    proof: "Top-rated milk drinks in Scotland since 2023.",
  },
  {
    slug: "papercup",
    name: "Papercup Coffee",
    city: "Glasgow",
    area: "glasgow",
    roaster: "Papercup",
    axes: { fruit: 0.8, floral: 0.6 },
    drinks: ["filter", "espresso"],
    score: 8.4,
    reviews: 52,
    pitch: "Glasgow's go-to for delicate filter. Don't order oat milk here.",
    proof: "Filter reviews: 8.9 avg on 'clarity'.",
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

export type RankedVenue = Venue & { _s: number; match: number };

export function scoreVenueFor(v: Venue, prefs: Prefs): number {
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

export function confidenceFor(v: Venue, prefs: Prefs): number {
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

export function rankVenues(prefs: Prefs): RankedVenue[] {
  const scored: RankedVenue[] = VENUES.map((v) => ({
    ...v,
    _s: scoreVenueFor(v, prefs),
    match: confidenceFor(v, prefs),
  }));
  scored.sort((a, b) => b._s - a._s);
  return scored;
}

export function reasonsFor(v: Venue, prefs: Prefs): string[] {
  const r: string[] = [];
  if (prefs.city && v.area === prefs.city) {
    const c = CITIES.find((c) => c.id === prefs.city);
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
