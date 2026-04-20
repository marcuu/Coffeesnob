import type { Venue } from "@/lib/types";

export type VenueMapItem = Pick<
  Venue,
  "id" | "slug" | "name" | "city" | "postcode" | "latitude" | "longitude"
>;

export type VenueMapPin = {
  id: string;
  slug: string;
  name: string;
  city: string;
  postcode: string;
  latitude: number;
  longitude: number;
};

export function toVenueMapPins(venues: VenueMapItem[]): VenueMapPin[] {
  return venues
    .filter(
      (venue): venue is VenueMapPin =>
        typeof venue.latitude === "number" && typeof venue.longitude === "number",
    )
    .map((venue) => ({
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
      city: venue.city,
      postcode: venue.postcode,
      latitude: venue.latitude,
      longitude: venue.longitude,
    }));
}

export function buildDirectionsUrl(pin: VenueMapPin): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${pin.latitude},${pin.longitude}`);
  return url.toString();
}
