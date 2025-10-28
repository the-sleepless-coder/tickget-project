import { useState, useRef, useEffect } from "react";
import ProfileBanner from "../../shared/ui/common/ProfileBanner";
import TabNavigation from "../../shared/ui/common/TabNavigation";
import SearchBar from "../../shared/ui/common/SearchBar";
import MatchHistoryCard from "../../shared/ui/common/MatchHistoryCard";
import PersonalStats from "../../shared/ui/common/PersonalStats";
import UserStats from "../../shared/ui/common/UserStats";
import { mockMatchHistory, type MatchHistory, type UserRank } from "./mockData";

export default function MyPageIndex() {
  const [activePrimaryTab, setActivePrimaryTab] = useState("stats");
  const [activeSecondaryTab, setActiveSecondaryTab] = useState("all");
  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState(1);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemsPerPage = 5;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRank | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [nickname, setNickname] = useState("닉네임");
  const [profileImage, setProfileImage] = useState<string | undefined>(
    undefined
  );
  const [tempNickname, setTempNickname] = useState("닉네임");
  const [tempProfileImage, setTempProfileImage] = useState<string | undefined>(
    undefined
  );

  // 참가인원에서 숫자를 추출하는 함수
  const getParticipantCount = (participants: string): number => {
    const match = participants.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // 모든 유저 목록 추출 (나를 제외, 닉네임 기준 고유)
  const allUsers = mockMatchHistory
    .flatMap((match) => match.users || [])
    .filter((user) => user.id !== 0)
    .reduce((acc, user) => {
      if (!acc.find((u) => u.nickname === user.nickname)) {
        acc.push(user);
      }
      return acc;
    }, [] as UserRank[]);

  // 검색어에 맞는 유저 필터링
  const filteredUsers = searchQuery.trim()
    ? allUsers.filter((user) =>
        user.nickname.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // 필터링 + 최신순 정렬 로직
  const filteredMatchHistory = mockMatchHistory
    .filter((match: MatchHistory) => {
      const count = getParticipantCount(match.participants);

      if (activeSecondaryTab === "all") {
        return true;
      } else if (activeSecondaryTab === "solo") {
        return count === 1;
      } else if (activeSecondaryTab === "match") {
        return count >= 2;
      }
      return true;
    })
    .sort((a: MatchHistory, b: MatchHistory) => {
      // 날짜와 시간 기준으로 최신순 정렬
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateB.getTime() - dateA.getTime();
    });

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredMatchHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const visibleItems = filteredMatchHistory.slice(startIndex, endIndex);

  // 카드가 확장될 때 해당 카드로 스크롤
  useEffect(() => {
    if (expandedCardIndex !== null && cardRefs.current[expandedCardIndex]) {
      const timer = setTimeout(() => {
        cardRefs.current[expandedCardIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expandedCardIndex]);

  // 필터가 변경되면 페이지 초기화
  useEffect(() => {
    setCurrentPage(1);
    setExpandedCardIndex(null);
  }, [activeSecondaryTab, activePrimaryTab]);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Profile Banner */}
      <ProfileBanner
        nickname={nickname}
        birthDate="99.01.28"
        email="tickget.gmail.com"
        profileImage={profileImage}
        isEditing={isEditingProfile}
        tempNickname={tempNickname}
        tempProfileImage={tempProfileImage}
        onEdit={() => {
          setTempNickname(nickname);
          setTempProfileImage(profileImage);
          setIsEditingProfile(true);
        }}
        onNicknameChange={(value) => setTempNickname(value)}
        onProfileImageChange={(file) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            setTempProfileImage(reader.result as string);
          };
          reader.readAsDataURL(file);
        }}
        onSave={() => {
          setNickname(tempNickname);
          setProfileImage(tempProfileImage);
          setIsEditingProfile(false);
        }}
        onCancel={() => {
          setTempNickname(nickname);
          setTempProfileImage(profileImage);
          setIsEditingProfile(false);
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-8">
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

            <div className="relative w-64">
              <SearchBar
                placeholder="타 유저 검색"
                className="w-full"
                onSearch={setSearchQuery}
                value={searchQuery}
              />
              {/* 검색 결과 드롭다운 */}
              {searchQuery.trim() && filteredUsers.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setSearchQuery("");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
                    >
                      <div className="h-8 w-8 rounded-full bg-neutral-300" />
                      <span className="text-sm text-neutral-700">
                        {user.nickname}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.trim() && filteredUsers.length === 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* Secondary Filter Tabs - 경기 기록일 때만 표시 */}
          {activePrimaryTab === "match-history" && (
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
          )}

          {/* Content Area */}
          <div className="space-y-4 px-6 pb-6">
            {activePrimaryTab === "match-history" ? (
              <>
                {visibleItems.map((match: MatchHistory, index: number) => (
                  <div
                    key={match.id}
                    ref={(el) => {
                      cardRefs.current[index] = el;
                    }}
                  >
                    <MatchHistoryCard
                      title={match.title}
                      participants={match.participants}
                      venue={match.venue}
                      venueType={match.venueType}
                      tags={match.tags}
                      date={match.date}
                      time={match.time}
                      mySeatArea={match.mySeatArea}
                      mySeatSection={match.mySeatSection}
                      users={match.users}
                      isExpanded={expandedCardIndex === index}
                      onExpand={() =>
                        setExpandedCardIndex(
                          expandedCardIndex === index ? null : index
                        )
                      }
                    />
                  </div>
                ))}

                {visibleItems.length === 0 && (
                  <div className="flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-8">
                    <div className="text-neutral-400">
                      표시할 항목이 없습니다.
                    </div>
                  </div>
                )}

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 pt-6">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-neutral-50"
                    >
                      이전
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                            currentPage === page
                              ? "border-purple-500 bg-purple-500 text-white"
                              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}

                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-neutral-50"
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            ) : selectedUser ? (
              // 타 유저 통계 탭
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-neutral-900">
                    {selectedUser.nickname}님의 통계
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setSearchQuery("");
                    }}
                    className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    돌아가기
                  </button>
                </div>
                <UserStats
                  userId={selectedUser.id}
                  userNickname={selectedUser.nickname}
                  matchHistory={mockMatchHistory}
                />
              </>
            ) : (
              // 개인 통계 탭
              <PersonalStats matchHistory={mockMatchHistory} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
