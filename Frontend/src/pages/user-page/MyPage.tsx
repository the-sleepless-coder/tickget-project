import { useState, useRef, useEffect } from "react";
import ProfileBanner from "./_components/ProfileBanner";
import ProfileInfoModal from "./_components/ProfileInfoModal";
// import TabNavigation from "../../shared/ui/common/TabNavigation";
// import SearchBar from "../../shared/ui/common/SearchBar";
// import MatchHistoryCard from "./_components/MatchHistoryCard";
// import PersonalStats from "./_components/PersonalStats";
import UserStats from "./_components/UserStats";
import { mockMatchHistory, type UserRank } from "./mockData";
import { useAuthStore } from "@features/auth/store";
import UnderConstruction from "../../shared/ui/common/Under_construction";

export default function MyPageIndex() {
  const [activePrimaryTab, setActivePrimaryTab] = useState("stats");
  // const [activeSecondaryTab, setActiveSecondaryTab] = useState("all");
  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(
    null
  );
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRank | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isProfileInfoModalOpen, setIsProfileInfoModalOpen] = useState(false);

  // store에서 닉네임과 이메일 가져오기
  const storeNickname = useAuthStore((state) => state.nickname);
  const storeEmail = useAuthStore((state) => state.email);

  const [nickname, setNickname] = useState(storeNickname || "닉네임");
  const [birthDate] = useState("90.01.01");
  const [email, setEmail] = useState(storeEmail || "tickget.gmail.com");
  const [profileImage, setProfileImage] = useState<string | undefined>(
    undefined
  );
  const [gender, setGender] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [tempNickname, setTempNickname] = useState("닉네임");
  const [tempProfileImage, setTempProfileImage] = useState<string | undefined>(
    undefined
  );

  // (사용 중지된 검색/필터 기능로직 제거)

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
    setExpandedCardIndex(null);
  }, [activePrimaryTab]);

  // store의 닉네임과 이메일이 변경되면 업데이트
  useEffect(() => {
    if (storeNickname) {
      setNickname(storeNickname);
    }
    if (storeEmail) {
      setEmail(storeEmail);
    }
  }, [storeNickname, storeEmail]);

  return (
    <div className="min-h-screen bg-neutral-50">
      {selectedUser && activePrimaryTab !== "stats" && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="mx-auto max-w-6xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActivePrimaryTab("stats");
                  setSelectedUser(null);
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                ← {selectedUser.nickname}님의 통계 보기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Banner */}
      <ProfileBanner
        nickname={nickname}
        birthDate={birthDate}
        email={email}
        profileImage={profileImage}
        isEditing={isEditingProfile}
        tempNickname={tempNickname}
        tempProfileImage={tempProfileImage}
        onEdit={() => {
          setTempNickname(nickname);
          setTempProfileImage(profileImage);
          setIsEditingProfile(true);
        }}
        onInfoManage={() => setIsProfileInfoModalOpen(true)}
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

      {/* Profile Info Modal */}
      <ProfileInfoModal
        open={isProfileInfoModalOpen}
        onClose={() => setIsProfileInfoModalOpen(false)}
        initialData={{
          gender,
          name,
          address,
          phoneNumber,
        }}
        onSave={(data) => {
          setGender(data.gender || "");
          setName(data.name || "");
          setAddress(data.address || "");
          setPhoneNumber(data.phoneNumber || "");
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-8">
        <div className="-mt-40 rounded-t-3xl bg-white pb-8 pt-8">
          {/* Primary Tabs and Search */}
          <div className="mb-4 flex items-center justify-between gap-4 px-6">
            {/* 탭 버튼 주석 처리 */}
            {/* <TabNavigation
              tabs={[
                { id: "stats", label: "개인 통계" },
                { id: "match-history", label: "경기 기록" },
              ]}
              activeTab={activePrimaryTab}
              onTabChange={setActivePrimaryTab}
              variant="primary"
            /> */}

            {/* 타 유저 검색 기능 주석 처리 */}
            {/* <div className="relative w-64">
              <SearchBar
                placeholder="타 유저 검색"
                className="w-full"
                onSearch={setSearchQuery}
                value={searchQuery}
              />
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
            </div> */}
          </div>

          {/* Secondary Filter Tabs - 경기 기록일 때만 표시 */}
          {/* {activePrimaryTab === "match-history" && (
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
          )} */}

          {/* Content Area */}
          <div className="space-y-4 px-6 pb-6">
            {activePrimaryTab === "match-history" && selectedUser ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-neutral-900">
                    {selectedUser.nickname}님의 통계
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedUser(null);
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
            ) : activePrimaryTab === "match-history" ? (
              <>
                {/* 경기 기록 탭 내용 주석 처리 */}
                {/* {visibleItems.map((match: MatchHistory, index: number) => (
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
                      onUserClick={(user) => setSelectedUser(user)}
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
                )} */}
                <UnderConstruction />
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
              <>
                {/* <PersonalStats matchHistory={mockMatchHistory} /> */}
                <UnderConstruction />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
