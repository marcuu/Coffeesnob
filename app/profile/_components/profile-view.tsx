import type { ProfileData } from "@/app/profile/_lib/fetch-profile";
import { ActivityFeed } from "./activity-feed";
import { ProfileHeader } from "./profile-header";
import { InvitePanel } from "./invite-panel";
import { ReputationModule } from "./reputation-module";
import { StatsSummary } from "./stats-summary";
import { TasteProfile } from "./taste-profile";

type Props = {
  data: ProfileData;
  isOwnProfile: boolean;
};

export function ProfileView({ data, isOwnProfile }: Props) {
  const { reviewer, reviews, citiesCount, streak, tasteProfile, reputation } =
    data;

  return (
    <>
      <ProfileHeader reviewer={reviewer} isOwnProfile={isOwnProfile} />
      <StatsSummary
        reviewer={reviewer}
        citiesCount={citiesCount}
        streak={streak}
      />
      {tasteProfile && <TasteProfile profile={tasteProfile} />}
      <ReputationModule reputation={reputation} />
      <InvitePanel
        weeklyLimit={data.invites.weeklyLimit}
        remainingThisWeek={data.invites.remainingThisWeek}
        isHighSignal={data.invites.isHighSignal}
        activity={data.inviteActivity}
        nowIso={new Date().toISOString()}
        isOwnProfile={isOwnProfile}
      />
      <ActivityFeed reviews={reviews.slice(0, 10)} />
    </>
  );
}
