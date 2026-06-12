import { permanentRedirect } from "next/navigation";

// Regional rankings live on the homepage behind the ?city= filter.
export default async function RegionRankingsPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  permanentRedirect(`/?city=${encodeURIComponent(region)}`);
}
