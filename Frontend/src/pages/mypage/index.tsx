import { useState } from "react";
import ProfileBanner from "../../shared/ui/common/ProfileBanner";
import TabNavigation from "../../shared/ui/common/TabNavigation";
import SearchBar from "../../shared/ui/common/SearchBar";
import MatchHistoryCard from "../../shared/ui/common/MatchHistoryCard";

export default function MyPageIndex() {
  const [activePrimaryTab, setActivePrimaryTab] = useState("match-history");
  const [activeSecondaryTab, setActiveSecondaryTab] = useState("all");

  // Mock data
  const mockMatchHistory = [
    {
      title: "18시에 티켓팅하실 분 모집합니다",
      participants: "참가인원 1명",
      venue: "돔형 콘서트장",
      venueType: "커스텀",
      tags: [
        { label: "어려움", color: "red" },
        { label: "최대 10명", color: "blue" },
        { label: "봇 3000명", color: "blue" },
      ],
    },
    {
      title: "20시에 티켓팅하실 분 모집합니다",
      participants: "참가인원 8명",
      venue: "오픈형 콘서트장",
      venueType: "자동",
      tags: [
        { label: "보통", color: "green" },
        { label: "최대 15명", color: "blue" },
      ],
    },
  ];

  // 참가인원에서 숫자를 추출하는 함수
  const getParticipantCount = (participants: string): number => {
    const match = participants.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // 필터링 로직
  const filteredMatchHistory = mockMatchHistory.filter((match) => {
    const count = getParticipantCount(match.participants);

    if (activeSecondaryTab === "all") {
      return true;
    } else if (activeSecondaryTab === "solo") {
      return count === 1;
    } else if (activeSecondaryTab === "match") {
      return count >= 2;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Profile Banner */}
      <ProfileBanner
        nickname="닉네임"
        birthDate="99.01.28"
        email="tickget.gmail.com"
      />

      {/* Main Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="-mt-40 rounded-t-3xl bg-white pb-8 pt-8">
          {/* Primary Tabs and Search */}
          <div className="mb-4 flex items-center justify-between gap-4 px-6">
            <TabNavigation
              tabs={[
                { id: "stats", label: "개인 통계" },
                { id: "match-history", label: "경기 기록" },
              ]}
              activeTab={activePrimaryTab}
              onTabChange={setActivePrimaryTab}
              variant="primary"
            />

            <SearchBar placeholder="타 유저 검색" className="w-64" />
          </div>

          {/* Secondary Filter Tabs */}
          <div className="mb-6 px-6">
            <TabNavigation
              tabs={[
                { id: "all", label: "전체" },
                { id: "solo", label: "솔로" },
                { id: "match", label: "대결" },
              ]}
              activeTab={activeSecondaryTab}
              onTabChange={setActiveSecondaryTab}
              variant="secondary"
            />
          </div>

          {/* Content Area */}
          <div className="space-y-4 px-6">
            {filteredMatchHistory.map((match, index) => (
              <MatchHistoryCard
                key={index}
                title={match.title}
                participants={match.participants}
                venue={match.venue}
                venueType={match.venueType}
                tags={match.tags}
              />
            ))}

            {filteredMatchHistory.length === 0 && (
              <div className="flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-8">
                <div className="text-neutral-400">표시할 항목이 없습니다.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
