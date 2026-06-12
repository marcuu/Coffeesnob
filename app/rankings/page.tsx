import { permanentRedirect } from "next/navigation";

// The rankings now live on the homepage — one canonical leaderboard.
export default function RankingsPage() {
  permanentRedirect("/");
}
