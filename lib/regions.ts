export const CITY_TO_REGION: Record<string, string> = {
  london: "london",
  leeds: "yorkshire",
  sheffield: "yorkshire",
  york: "yorkshire",
  huddersfield: "yorkshire",
  harrogate: "yorkshire",
  holmfirth: "yorkshire",
  wakefield: "yorkshire",
};

export const REGION_NAMES: Record<string, string> = {
  london: "London",
  yorkshire: "Yorkshire",
};

export const REGION_TO_CITIES: Record<string, string[]> = {
  london: ["London"],
  yorkshire: ["Leeds", "Sheffield", "York", "Huddersfield", "Harrogate", "Holmfirth", "Wakefield"],
};

export function regionIdFromCityName(cityName: string): string {
  const cityId = cityName.trim().toLowerCase().replace(/\s+/g, "-");
  return CITY_TO_REGION[cityId] ?? cityId;
}
