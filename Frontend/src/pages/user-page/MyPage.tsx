import { useState, useRef, useEffect } from "react";
import ProfileBanner from "./_components/ProfileBanner";
import ProfileInfoModal from "./_components/ProfileInfoModal";
import TabNavigation from "../../shared/ui/common/TabNavigation";
// import SearchBar from "../../shared/ui/common/SearchBar";
import MatchHistoryCard from "./_components/MatchHistoryCard";
import PersonalStats from "./_components/PersonalStats";
import UserStats from "./_components/UserStats";
import { type UserRank, type MatchHistory } from "./mockData";
import { useAuthStore } from "@features/auth/store";
import { compressImage } from "@shared/utils/imageCompression";
import { normalizeProfileImageUrl } from "@shared/utils/profileImageUrl";
import { getMatchHistory } from "@features/user-page/api";
import AnalysisTab from "./_components/AnalysisTab";
import type { MatchDataResponse } from "@features/user-page/types";
import dayjs from "dayjs";

export default function MyPageIndex() {
  const [activePrimaryTab, setActivePrimaryTab] = useState("stats");
  const [activeSecondaryTab, setActiveSecondaryTab] = useState("all");
  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(
    null
  );
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRank | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isProfileInfoModalOpen, setIsProfileInfoModalOpen] = useState(false);

  // store에서 닉네임, 이메일, 프로필 이미지 가져오기
  const storeNickname = useAuthStore((state) => state.nickname);
  const storeEmail = useAuthStore((state) => state.email);
  const storeProfileImageUrl = useAuthStore((state) => state.profileImageUrl);
  const storeUserId = useAuthStore((state) => state.userId);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [nickname, setNickname] = useState(storeNickname || "닉네임");
  const [birthDate, setBirthDate] = useState("");
  const [birthDateRaw, setBirthDateRaw] = useState<string>("");
  const [email, setEmail] = useState(storeEmail || "tickget.gmail.com");
  const [profileImage, setProfileImage] = useState<string | undefined>(
    normalizeProfileImageUrl(storeProfileImageUrl, storeUserId) || undefined
  );
  const [gender, setGender] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [tempNickname, setTempNickname] = useState("닉네임");
  const [tempProfileImage, setTempProfileImage] = useState<string | undefined>(
    undefined
  );
  const [tempProfileImageFile, setTempProfileImageFile] = useState<File | null>(
    null
  );
  const [tempBirthDate, setTempBirthDate] = useState<string | undefined>(
    undefined
  );

  const formatBirthDate = (value?: string | null): string => {
    if (!value) return "";
    if (value.includes("-")) {
      const [year, month, day] = value.split("-");
      return `${year.slice(-2)}.${month}.${day}`;
    }
    return value;
  };

  // hallName을 한글로 변환하는 함수
  const convertHallNameToKorean = (hallName: string): string => {
    const hallNameMap: Record<string, string> = {
      InspireArena: "인스파이어 아레나",
      CharlotteTheater: "샤롯데씨어터",
      OlympicHall: "올림픽공원 올림픽홀",
    };
    return hallNameMap[hallName] || hallName;
  };

  // difficulty를 한글로 변환하는 함수
  const convertDifficultyToKorean = (difficulty: string): string => {
    const difficultyMap: Record<string, string> = {
      EASY: "쉬움",
      MEDIUM: "보통",
      HARD: "어려움",
    };
    return difficultyMap[difficulty] || difficulty;
  };

  // selectedSeat을 파싱하여 section, row, col 추출
  const parseSeat = (
    selectedSeat: string
  ): {
    section: string;
    row: number;
    col: number;
  } | null => {
    // 형식: "1-19-44" -> section: "1", row: 19, col: 44
    const parts = selectedSeat.split("-");
    if (parts.length >= 3) {
      return {
        section: parts[0],
        row: parseInt(parts[1], 10),
        col: parseInt(parts[2], 10),
      };
    }
    return null;
  };

  // API 응답을 MatchHistory 형식으로 변환
  const convertMatchDataToMatchHistory = (
    matchData: MatchDataResponse,
    currentUserId: number
  ): MatchHistory | null => {
    const { matchInfo, specifics } = matchData;

    // 내 정보 찾기
    const mySpecifics = specifics.find((s) => s.userId === currentUserId);
    if (!mySpecifics) return null; // 내가 참가하지 않은 경기는 제외

    // 날짜와 시간 파싱
    const startedAt = dayjs(matchInfo.startedAt);
    const date = startedAt.format("YYYY-MM-DD");
    const time = startedAt.format("HH:mm");

    // 좌석 정보 파싱
    const seatInfo = parseSeat(mySpecifics.selectedSeat);
    const mySeatArea = seatInfo
      ? `${seatInfo.row}-${seatInfo.col}`
      : mySpecifics.selectedSeat;
    const mySeatSection = seatInfo
      ? seatInfo.section
      : mySpecifics.selectedSection;

    // 공연장 이름과 AI 생성 여부
    const hallNameKorean = convertHallNameToKorean(matchInfo.hallName);
    const venueType = matchInfo.isAIGenerated ? "AI 생성" : "프리셋";

    // 태그 생성
    const getDifficultyTagClass = (difficulty: string): string => {
      switch (difficulty) {
        case "EASY":
          return "bg-[#F9FBAD] text-[#8DBA07]";
        case "MEDIUM":
          return "bg-[#FFEEA2] text-[#FF8800]";
        case "HARD":
          return "bg-[#FFDEDE] text-[#FF4040]";
        default:
          return "bg-neutral-400 text-white";
      }
    };

    const tags = [
      {
        label: convertDifficultyToKorean(matchInfo.difficulty),
        color: matchInfo.difficulty === "HARD" ? "red" : "blue",
        className: getDifficultyTagClass(matchInfo.difficulty),
      },
      {
        label: `총 좌석수 ${matchInfo.totalSeat.toLocaleString()}명`,
        color: "purple",
        className: "bg-c-purple-100 text-c-purple-400",
      },
      {
        label: `봇 ${matchInfo.botCount}명`,
        color: "purple",
        className: "bg-c-purple-100 text-c-purple-400",
      },
    ];

    // 사용자 정보 변환
    const users: UserRank[] = specifics.map((spec) => {
      const seatInfo = parseSeat(spec.selectedSeat);
      const isMe = spec.userId === currentUserId;

      return {
        id: isMe ? 0 : spec.userId,
        nickname: spec.userNickname,
        rank: spec.totalRank,
        seatArea: seatInfo
          ? `${seatInfo.row}-${seatInfo.col}`
          : spec.selectedSeat,
        seatSection: seatInfo ? seatInfo.section : spec.selectedSection,
        seatRow: seatInfo?.row,
        seatCol: seatInfo?.col,
        time: spec.totalTime.toFixed(2),
        metrics: {
          bookingClick: {
            reactionMs: Math.round(spec.queueSelectTime * 1000),
            misclicks: spec.queueMissCount,
          },
          captcha: {
            durationMs: Math.round(spec.captchaSelectTime * 1000),
            wrongCount: spec.captchaTrialCount,
            backspaceCount: spec.captchaBackspaceCount,
          },
          seatSelection: {
            durationMs: Math.round(spec.seatSelectTime * 1000),
            misclicks: spec.seatSelectClickMissCount,
            duplicateSeat: spec.seatSelectTrialCount,
          },
        },
        // 차이 값은 다른 사용자일 때만 추가
        ...(isMe
          ? {}
          : {
              differenceMetrics: {
                bookingClick: {
                  reactionMs: Math.round(spec.queueTimeDifference * 1000),
                  misclicks: spec.queueMissCountDifference,
                },
                captcha: {
                  durationMs: Math.round(spec.captchaTimeDifference * 1000),
                  backspaceCount: spec.captchaBackSpaceCountDifference,
                },
                seatSelection: {
                  durationMs: Math.round(spec.seatSelectTimeDifference * 1000),
                  misclicks: spec.seatClickMissDifference,
                  duplicateSeat: spec.seatTrialCountDifference,
                },
              },
            }),
      };
    });

    // hallId와 tsxUrl은 첫 번째 specifics에서 가져오기 (모든 사용자가 같은 hallId와 tsxUrl을 가짐)
    const hallId = specifics[0]?.hallId;
    // tsxUrl은 specifics에 있거나 matchInfo에 있을 수 있음
    const tsxUrl = specifics[0]?.tsxUrl || matchInfo.tsxUrl;

    return {
      id: matchInfo.matchId,
      title: matchInfo.matchName,
      participants: `참가인원 ${specifics.length}명`,
      venue: hallNameKorean,
      venueType,
      tags,
      date,
      time,
      mySeatArea,
      mySeatSection,
      users,
      userSuccess: matchInfo.userSuccess,
      totalTime: mySpecifics.totalTime,
      isAIGenerated: matchInfo.isAIGenerated,
      tsxUrl: tsxUrl && tsxUrl !== "default" ? tsxUrl : null,
      hallId: hallId,
      roomType: matchInfo.roomType,
    };
  };

  // 경기 기록 필터링 및 페이지네이션
  const [currentPage, setCurrentPage] = useState(1); // 프론트엔드는 1-based로 관리
  const [matchHistoryData, setMatchHistoryData] = useState<MatchHistory[]>([]);
  const [isLoadingMatchHistory, setIsLoadingMatchHistory] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true); // 다음 페이지 존재 여부

  // API에서 경기 기록 가져오기
  useEffect(() => {
    let cancelled = false;
    setIsLoadingMatchHistory(true);
    (async () => {
      try {
        const mode =
          activeSecondaryTab === "solo"
            ? "solo"
            : activeSecondaryTab === "match"
              ? "multi"
              : "all";
        // 프론트엔드는 1-based, API는 0-based이므로 변환 (1 -> 0, 2 -> 1, ...)
        const backendPage = currentPage - 1;
        const data = await getMatchHistory(mode, backendPage);
        if (!cancelled && storeUserId) {
          const converted = data
            .map((matchData) =>
              convertMatchDataToMatchHistory(matchData, storeUserId)
            )
            .filter((match): match is MatchHistory => match !== null)
            .sort((a, b) => {
              // 날짜순으로 정렬 (최신순)
              const dateA = new Date(a.date).getTime();
              const dateB = new Date(b.date).getTime();
              return dateB - dateA;
            });
          setMatchHistoryData(converted);
          // 다음 페이지가 있는지 확인 (데이터가 비어있으면 더 이상 없음)
          setHasMorePages(converted.length > 0);
        }
      } catch (error) {
        console.error("경기 기록 불러오기 실패:", error);
        if (!cancelled) {
          setMatchHistoryData([]);
          setHasMorePages(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMatchHistory(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSecondaryTab, storeUserId, currentPage]);

  // 필터링된 경기 기록 (이미 API에서 필터링됨)
  const filteredMatchHistory = matchHistoryData;
  const visibleItems = filteredMatchHistory;

  // 필터가 변경되면 첫 페이지로 및 확장된 카드 초기화
  useEffect(() => {
    setCurrentPage(1);
    setExpandedCardIndex(null);
  }, [activeSecondaryTab]);

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

  // 탭이 변경되면 페이지 초기화 및 확장된 카드 초기화
  useEffect(() => {
    setExpandedCardIndex(null);
    setCurrentPage(1);
  }, [activePrimaryTab]);

  // store의 닉네임, 이메일, 프로필 이미지가 변경되면 업데이트
  useEffect(() => {
    if (storeNickname) {
      setNickname(storeNickname);
    }
    if (storeEmail) {
      setEmail(storeEmail);
    }
    if (storeProfileImageUrl) {
      // store의 profileImageUrl이 변경되면 캐시 무효화를 위해 cacheBust 적용
      setProfileImage(
        normalizeProfileImageUrl(storeProfileImageUrl, storeUserId, true) ||
          undefined
      );
    }
  }, [storeNickname, storeEmail, storeProfileImageUrl, storeUserId]);

  // 프로필 정보 가져오기 (생년월일 포함)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!accessToken) return;

      try {
        // Vite 프록시를 통해 요청 (상대 경로 사용)
        const apiUrl = "/api/v1/dev/user/myprofile";
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();

          // 생년월일 설정
          if (data.birthDate) {
            setBirthDateRaw(data.birthDate);
            setBirthDate(formatBirthDate(data.birthDate));
          } else {
            setBirthDateRaw("");
            setBirthDate("");
          }

          // 프로필 이미지 업데이트 (API에서 받은 값이 있으면 사용)
          if (data.profileImageUrl) {
            const { setAuth } = useAuthStore.getState();
            const currentAuth = useAuthStore.getState();
            setAuth({
              accessToken: currentAuth.accessToken || "",
              refreshToken: currentAuth.refreshToken,
              userId: currentAuth.userId || 0,
              email: currentAuth.email || "",
              nickname: currentAuth.nickname || "",
              name: currentAuth.name || "",
              profileImageUrl: data.profileImageUrl,
              message: "프로필 정보 업데이트",
            });
            setProfileImage(
              normalizeProfileImageUrl(data.profileImageUrl, storeUserId) ||
                undefined
            );
          }

          // 내 정보 관리용 데이터 설정
          // 성별 변환: MALE -> 남성, FEMALE -> 여성, UNKNOWN -> 선택하지 않음
          if (data.gender) {
            const genderMap: Record<string, string> = {
              MALE: "남성",
              FEMALE: "여성",
              UNKNOWN: "선택하지 않음",
            };
            setGender(genderMap[data.gender] || "");
          }
          if (data.name) {
            setName(data.name);
          }
          if (data.address) {
            setAddress(data.address);
          }
          if (data.phone) {
            setPhoneNumber(data.phone);
          }
        }
      } catch (error) {
        console.error("프로필 정보 가져오기 실패:", error);
      }
    };

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, storeProfileImageUrl]);

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
                className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
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
        birthDateRaw={birthDateRaw}
        email={email}
        profileImage={profileImage}
        isEditing={isEditingProfile}
        tempNickname={tempNickname}
        tempProfileImage={tempProfileImage}
        tempBirthDate={tempBirthDate}
        onEdit={() => {
          setTempNickname(nickname);
          setTempProfileImage(profileImage);
          setTempProfileImageFile(null);
          setTempBirthDate(birthDateRaw || "");
          setIsEditingProfile(true);
        }}
        onInfoManage={() => setIsProfileInfoModalOpen(true)}
        onNicknameChange={(value) => setTempNickname(value)}
        onBirthDateChange={(value) => setTempBirthDate(value)}
        onProfileImageChange={async (file) => {
          try {
            // 파일 크기 체크 및 압축 (10MB 이하로)
            const compressedFile = await compressImage(file, {
              maxWidth: 1920,
              maxHeight: 1920,
              maxSizeMB: 10,
              quality: 0.9,
            });

            // 압축된 파일 객체 저장 (POST 요청용)
            setTempProfileImageFile(compressedFile);
            // 미리보기용 base64 변환
            const reader = new FileReader();
            reader.onloadend = () => {
              setTempProfileImage(reader.result as string);
            };
            reader.readAsDataURL(compressedFile);
          } catch (error) {
            console.error("이미지 압축 오류:", error);
            alert("이미지 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
          }
        }}
        onSave={async () => {
          if (!accessToken) {
            alert("인증 정보가 없습니다. 다시 로그인해주세요.");
            return;
          }

          try {
            // 기존 auth store 정보 가져오기
            const currentAuth = useAuthStore.getState();
            const { setAuth } = useAuthStore.getState();

            // 프로필 이미지 업로드 (파일이 변경된 경우)
            let newProfileImageUrl = currentAuth.profileImageUrl || null;
            if (tempProfileImageFile) {
              const formData = new FormData();
              formData.append("file", tempProfileImageFile);

              const imageUploadUrl = "/api/v1/dev/user/profile-image";
              const imageResponse = await fetch(imageUploadUrl, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  // FormData를 사용할 때는 Content-Type을 설정하지 않음 (브라우저가 자동 설정)
                },
                body: formData,
              });

              if (!imageResponse.ok) {
                const errorText = await imageResponse.text().catch(() => "");
                throw new Error(
                  `프로필 이미지 업로드 실패: ${imageResponse.status} ${errorText}`
                );
              }

              const imageData = await imageResponse.json().catch(() => ({}));
              newProfileImageUrl = imageData.profileImageUrl || null;

              // 프로필 이미지 업로드 성공 시 즉시 store 업데이트 및 헤더 캐시 무효화 트리거
              if (newProfileImageUrl !== null) {
                const {
                  setAuth: setAuthImmediate,
                  triggerProfileImageRefresh,
                } = useAuthStore.getState();
                const currentAuthImmediate = useAuthStore.getState();
                setAuthImmediate({
                  accessToken: currentAuthImmediate.accessToken || "",
                  refreshToken: currentAuthImmediate.refreshToken,
                  userId: currentAuthImmediate.userId || 0,
                  email: currentAuthImmediate.email || "",
                  nickname: currentAuthImmediate.nickname || "",
                  name: currentAuthImmediate.name || "",
                  profileImageUrl: newProfileImageUrl,
                  message: "프로필 이미지 업로드 완료",
                });
                // 헤더의 프로필 이미지 캐시 무효화 트리거
                triggerProfileImageRefresh();
              }
            }

            // 닉네임/생년월일 수정
            const profileUpdatePayload: Record<string, unknown> = {};
            if (tempNickname !== nickname) {
              profileUpdatePayload.nickname = tempNickname;
            }
            if (tempBirthDate !== undefined && tempBirthDate !== birthDateRaw) {
              profileUpdatePayload.birthDate = tempBirthDate || null;
            }

            let updatedNickname = currentAuth.nickname || "";
            let updatedBirthDateRaw = birthDateRaw;

            if (Object.keys(profileUpdatePayload).length > 0) {
              const apiUrl = "/api/v1/dev/user/myprofile";
              const response = await fetch(apiUrl, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(profileUpdatePayload),
              });

              if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new Error(
                  `프로필 수정 실패: ${response.status} ${errorText}`
                );
              }

              const responseData = await response.json().catch(() => ({}));
              if (profileUpdatePayload.nickname !== undefined) {
                updatedNickname =
                  responseData.nickname ||
                  tempNickname ||
                  currentAuth.nickname ||
                  "";
              } else {
                updatedNickname = nickname;
              }
              if (profileUpdatePayload.birthDate !== undefined) {
                updatedBirthDateRaw =
                  responseData.birthDate ||
                  (typeof profileUpdatePayload.birthDate === "string"
                    ? profileUpdatePayload.birthDate
                    : "") ||
                  "";
              }
            } else {
              updatedNickname = nickname;
            }

            const hasNicknameChange = tempNickname !== nickname;
            const hasProfileImageChange =
              newProfileImageUrl !== currentAuth.profileImageUrl;
            const hasBirthDateChange =
              tempBirthDate !== undefined && tempBirthDate !== birthDateRaw;

            if (
              hasNicknameChange ||
              hasProfileImageChange ||
              hasBirthDateChange
            ) {
              let message = "프로필 수정 완료";
              if (
                hasNicknameChange &&
                !hasProfileImageChange &&
                !hasBirthDateChange
              ) {
                message = "닉네임 수정 완료";
              } else if (
                !hasNicknameChange &&
                hasProfileImageChange &&
                !hasBirthDateChange
              ) {
                message = "프로필 이미지 업로드 완료";
              } else if (
                !hasNicknameChange &&
                !hasProfileImageChange &&
                hasBirthDateChange
              ) {
                message = "생년월일 수정 완료";
              }

              // 프로필 이미지가 변경된 경우 store에 원본 URL 저장
              // Header에서 rawProfileImageUrl 변경을 감지하여 캐시 무효화 적용
              // store에는 타임스탬프 없이 저장하고, Header에서 변경 감지 시 타임스탬프 추가
              const storeProfileImageUrl = newProfileImageUrl;

              setAuth({
                accessToken: currentAuth.accessToken || "",
                refreshToken: currentAuth.refreshToken,
                userId: currentAuth.userId || 0,
                email: currentAuth.email || "",
                nickname: updatedNickname,
                name: currentAuth.name || "",
                profileImageUrl: storeProfileImageUrl,
                message,
              });
            }

            // 로컬 state 업데이트
            setNickname(updatedNickname);
            setBirthDateRaw(updatedBirthDateRaw);
            setBirthDate(formatBirthDate(updatedBirthDateRaw));
            // 프로필 이미지가 변경된 경우 캐시 무효화를 위해 timestamp 추가
            const shouldCacheBust = hasProfileImageChange;
            setProfileImage(
              tempProfileImage ||
                normalizeProfileImageUrl(
                  newProfileImageUrl,
                  storeUserId,
                  shouldCacheBust
                ) ||
                undefined
            );
            setTempProfileImageFile(null);
            setTempBirthDate(updatedBirthDateRaw);
            setIsEditingProfile(false);
          } catch (error) {
            console.error("프로필 수정 오류:", error);
            const errorMessage =
              error instanceof Error
                ? error.message
                : "프로필 수정 중 오류가 발생했습니다.";
            alert(errorMessage);
          }
        }}
        onCancel={() => {
          // 취소 시 아무것도 하지 않음 (기존 값으로 되돌림만)
          setTempNickname(nickname);
          setTempProfileImage(profileImage);
          setTempProfileImageFile(null);
          setTempBirthDate(birthDateRaw || "");
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
        onSave={async (data) => {
          if (!accessToken) {
            alert("인증 정보가 없습니다. 다시 로그인해주세요.");
            return;
          }

          try {
            // 성별 변환: 남성 -> MALE, 여성 -> FEMALE, 선택하지 않음 -> UNKNOWN
            const genderMap: Record<string, string> = {
              남성: "MALE",
              여성: "FEMALE",
              "선택하지 않음": "UNKNOWN",
            };
            const genderValue = data.gender
              ? genderMap[data.gender] || "UNKNOWN"
              : "UNKNOWN";

            // PATCH 요청 보내기 (name, gender, phone, address만 전송)
            const apiUrl = "/api/v1/dev/user/myprofile";
            const response = await fetch(apiUrl, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                name: data.name || "",
                gender: genderValue,
                phone: data.phoneNumber || "",
                address: data.address || "",
              }),
            });

            if (!response.ok) {
              const errorText = await response.text().catch(() => "");
              throw new Error(
                `정보 수정 실패: ${response.status} ${errorText}`
              );
            }

            // 응답 데이터 받기
            const responseData = await response.json().catch(() => ({}));

            // auth store 업데이트
            const { setAuth } = useAuthStore.getState();
            const currentAuth = useAuthStore.getState();
            setAuth({
              accessToken: currentAuth.accessToken || "",
              refreshToken: currentAuth.refreshToken,
              userId: currentAuth.userId || 0,
              email: currentAuth.email || "",
              nickname: currentAuth.nickname || "",
              name: responseData.name || data.name || currentAuth.name || "",
              profileImageUrl: currentAuth.profileImageUrl || null,
              message: "내 정보 수정 완료",
            });

            // 로컬 state 업데이트
            setGender(data.gender || "");
            setName(data.name || "");
            setAddress(data.address || "");
            setPhoneNumber(data.phoneNumber || "");
          } catch (error) {
            console.error("정보 수정 오류:", error);
            const errorMessage =
              error instanceof Error
                ? error.message
                : "정보 수정 중 오류가 발생했습니다.";
            alert(errorMessage);
          }
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
                { id: "analysis", label: "AI 분석" },
              ]}
              activeTab={activePrimaryTab}
              onTabChange={setActivePrimaryTab}
              variant="primary"
            />

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
                    className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    돌아가기
                  </button>
                </div>
                <UserStats
                  userId={selectedUser.id}
                  userNickname={selectedUser.nickname}
                  matchHistory={matchHistoryData}
                />
              </>
            ) : activePrimaryTab === "match-history" ? (
              <>
                {isLoadingMatchHistory ? (
                  <div className="flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-8">
                    <div className="text-neutral-400">로딩 중</div>
                  </div>
                ) : (
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
                          userSuccess={match.userSuccess}
                          totalTime={match.totalTime}
                          isExpanded={expandedCardIndex === index}
                          onExpand={() =>
                            setExpandedCardIndex(
                              expandedCardIndex === index ? null : index
                            )
                          }
                          onUserClick={(user) => setSelectedUser(user)}
                          isAIGenerated={match.isAIGenerated}
                          tsxUrl={match.tsxUrl}
                          hallId={match.hallId}
                          roomType={match.roomType}
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
                  </>
                )}

                {/* 페이지네이션 - 항상 표시 (경기 기록이 있을 때만) */}
                {filteredMatchHistory.length > 0 && (
                  <div className="flex justify-center items-center gap-2 pt-6 pb-4">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1 || isLoadingMatchHistory}
                      className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 hover:bg-neutral-50 disabled:hover:bg-white"
                    >
                      이전
                    </button>

                    <span className="px-4 py-2 text-sm font-medium text-neutral-700">
                      {currentPage}페이지
                    </span>

                    <button
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      disabled={!hasMorePages || isLoadingMatchHistory}
                      className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 hover:bg-neutral-50 disabled:hover:bg-white"
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
                    }}
                    className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    돌아가기
                  </button>
                </div>
                <UserStats
                  userId={selectedUser.id}
                  userNickname={selectedUser.nickname}
                  matchHistory={matchHistoryData}
                />
              </>
            ) : activePrimaryTab === "analysis" ? (
              // AI 분석 탭
              <AnalysisTab />
            ) : (
              // 개인 통계 탭
              <>
                <PersonalStats />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
