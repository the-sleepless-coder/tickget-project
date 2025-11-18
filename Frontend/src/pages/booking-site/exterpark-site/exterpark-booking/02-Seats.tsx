import {
  useEffect,
  useState,
  useRef,
  useMemo,
  type CSSProperties,
} from "react";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRoomStore } from "@features/room/store";
import { useMatchStore } from "@features/booking-site/store";
import { useAuthStore } from "@features/auth/store";
import {
  holdSeat,
  getSectionSeatsStatus,
  buildSeatMetricsPayload,
  sendSeatStatsFailedForMatch,
} from "@features/booking-site/api";
import { paths } from "../../../../app/routes/paths";
import {
  saveInitialReaction,
  setCaptchaEndNow,
  recordSeatCompleteNow,
  setTotalStartAtMs,
  buildMetricsQueryFromStorage,
} from "../../../../shared/utils/reserveMetrics";
import { useWebSocketStore } from "../../../../shared/lib/websocket-store";
import { subscribe, type Subscription } from "../../../../shared/lib/websocket";
import { useSeatStatsFailedOnUnload } from "../../../../shared/hooks/useSeatStatsFailedOnUnload";
import Viewport from "./_components/Viewport";
import SeatGrades from "./_components/Side_Grades";
import SeatSidebarBanner from "./_components/Side_Banner";
import CaptchaModal from "./_components/CaptchaModal";
import SeatTakenAlert from "../../../../components/SeatTakenAlert";
import SmallVenue from "../../../performance-halls/small-venue/CharlotteTheater";
import MediumVenue, {
  type MediumVenueRef,
} from "../../../performance-halls/medium-venue/OlympicHall";
import LargeVenue, {
  type LargeVenueRef,
} from "../../../performance-halls/large-venue/InspireArena";
import TsxPreview from "../../../../shared/components/TsxPreview";

type GradeKey = "SR" | "R" | "S" | "A" | "STANDING";
type SelectedSeat = {
  id: string;
  gradeLabel: string;
  label: string;
  price?: number;
};

const GRADE_META: Record<
  GradeKey,
  { name: string; color: string; price: number }
> = {
  SR: { name: "VIP석", color: "#6f53e3", price: 143000 },
  R: { name: "R석", color: "#3da14b", price: 132000 },
  S: { name: "S석", color: "#59b3ea", price: 110000 },
  A: { name: "A석", color: "#FB7E4E", price: 80000 },
  STANDING: { name: "스탠딩석", color: "#9ca3af", price: 170000 },
};

// 등급 레이블로 가격 찾기
const getPriceByGradeLabel = (gradeLabel: string): number => {
  // "스탠딩석", "VIP석", "R석", "S석", "A석", "SR석" 등
  if (gradeLabel.includes("스탠딩")) return GRADE_META.STANDING.price;
  if (gradeLabel.includes("VIP")) return GRADE_META.SR.price; // VIP석 = SR석 가격
  if (gradeLabel.includes("R석")) return GRADE_META.R.price;
  if (gradeLabel.includes("S석")) return GRADE_META.S.price;
  if (gradeLabel.includes("A석")) return GRADE_META.A.price;
  if (gradeLabel.includes("SR석")) return GRADE_META.SR.price;
  // 기본값
  return GRADE_META.S.price;
};

// 등급 코드를 한글 레이블로 변환
const convertGradeToLabel = (grade: string): string => {
  const gradeUpper = grade.toUpperCase();
  if (gradeUpper === "STANDING") return "스탠딩";
  if (gradeUpper === "VIP" || gradeUpper === "SR") return "VIP석";
  if (gradeUpper === "R") return "R석";
  if (gradeUpper === "S") return "S석";
  if (gradeUpper === "A") return "A석";
  // 기본값
  return grade;
};

type VenueKind = "small" | "medium" | "large";

export default function SelectSeatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<SelectedSeat[]>([]);
  const roomInfo = useRoomStore((s) => s.roomInfo);
  const eventTitle = roomInfo.roomName || "방 이름 입력";
  const venueName = roomInfo.hallName || "공연장 이름";
  const captchaPassed = useRoomStore((s) => s.roomInfo.captchaPassed);
  const setCaptchaPassed = useRoomStore((s) => s.setCaptchaPassed);
  // captchaPassed가 false일 때만 캡챠 표시
  const [showCaptcha, setShowCaptcha] = useState<boolean>(!captchaPassed);
  const [captchaBackspaces, setCaptchaBackspaces] = useState<number>(0);
  const [captchaWrongAttempts, setCaptchaWrongAttempts] = useState<number>(0);
  // 보안문자 입력 이후 클릭 실수 추적
  const [isTrackingSeatClicks, setIsTrackingSeatClicks] =
    useState<boolean>(false);
  const [seatClickMissCount, setSeatClickMissCount] = useState<number>(0);
  // 이미 선택한 좌석 알림 표시 횟수
  const [seatTakenAlertCount, _setSeatTakenAlertCount] = useState<number>(0);
  const [showSeatTakenAlert, setShowSeatTakenAlert] = useState<boolean>(false);

  // captchaPassed 상태가 변경되면 showCaptcha 업데이트
  useEffect(() => {
    setShowCaptcha(!captchaPassed);
  }, [captchaPassed]);

  // 보안문자 입력 이후 섹션이나 좌석 이외의 영역 클릭 실수 추적 (현재 비활성화)
  useEffect(() => {
    if (!isTrackingSeatClicks) return;
    const onDocClick = () => {
      // 요구사항: 좌석 선택 단계에서 클릭 실수 카운트 증가시키지 않음
      return;
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [isTrackingSeatClicks]);

  // Captcha modal open time for live measurement (and let HUD pick it up)
  useEffect(() => {
    if (showCaptcha) {
      sessionStorage.setItem("reserve.captchaStartAtMs", String(Date.now()));
    } else {
      sessionStorage.removeItem("reserve.captchaStartAtMs");
    }
  }, [showCaptcha]);

  // 이미 선택한 좌석 알림이 표시될 때마다 카운트 증가
  useEffect(() => {
    if (showSeatTakenAlert && isTrackingSeatClicks) {
      _setSeatTakenAlertCount((prev) => prev + 1);
    }
  }, [showSeatTakenAlert, isTrackingSeatClicks]);
  const mediumVenueRef = useRef<MediumVenueRef | null>(null);
  const largeVenueRef = useRef<LargeVenueRef | null>(null);

  // hallId 기반 venue 결정
  // hallId 2: 샤롯데씨어터 (small)
  // hallId 3: 올림픽 홀 (medium)
  // hallId 4: 인스파이어 아레나 (large)
  // hallId 5 이상: AI 생성 공연장
  const hallIdParam = searchParams.get("hallId");
  const hallIdFromStore = useRoomStore((s) => s.roomInfo.hallId);
  const hallId = hallIdParam ? Number(hallIdParam) : (hallIdFromStore ?? null);

  // hallType과 tsxUrl 가져오기
  const hallTypeParam = searchParams.get("hallType");
  const tsxUrlParam = searchParams.get("tsxUrl");
  const tsxUrlFromStore = useRoomStore((s) => s.roomInfo.tsxUrl);
  const hallType = hallTypeParam;
  const tsxUrl = tsxUrlParam || tsxUrlFromStore || null;
  // hallId가 5 이상이거나 hallType이 "AI_GENERATED"이면 AI 생성 공연장
  const isAIGenerated =
    hallType === "AI_GENERATED" || (hallId !== null && hallId >= 5);

  // hallId를 venue로 변환
  const getVenueFromHallId = (id: number | null): VenueKind => {
    if (id === 2) return "small"; // 샤롯데씨어터
    if (id === 3) return "medium"; // 올림픽 홀
    if (id === 4) return "large"; // 인스파이어 아레나
    return "small"; // 기본값
  };

  // AI 생성된 방의 경우 hallSize에 따라 venue 결정 (small 제외, medium 또는 large)
  // hallSize는 URL 파라미터에서 가져오거나 기본값 사용
  const hallSizeParam = searchParams.get("hallSize");

  // 디버깅: AI 생성 방 정보 확인
  if (isAIGenerated) {
    console.log("[02-Seats] AI Generated Room:", {
      hallId,
      hallType,
      tsxUrl,
      isAIGenerated,
      hallSize: hallSizeParam,
    });
  }
  const getAIVenueFromHallSize = (size: string | null): VenueKind => {
    if (size === "LARGE" || size === "large") return "large";
    return "medium"; // MEDIUM, medium 또는 기본값
  };

  // 기존 venue 쿼리 파라미터도 지원 (하위 호환성)
  const venueParam = searchParams.get("venue");
  const venueKey: VenueKind = isAIGenerated
    ? getAIVenueFromHallSize(hallSizeParam)
    : hallId
      ? getVenueFromHallId(hallId)
      : venueParam === "medium" ||
          venueParam === "large" ||
          venueParam === "small"
        ? venueParam
        : "small";

  // roomInfo의 startTime에서 기본 날짜/시간 추출 (useMemo로 최적화)
  const defaultDateTime = useMemo(() => {
    if (roomInfo.startTime) {
      try {
        // "2025-11-15T14:43:00" 형식 파싱
        const dateTime = new Date(roomInfo.startTime);
        if (!isNaN(dateTime.getTime())) {
          const year = dateTime.getFullYear();
          const month = String(dateTime.getMonth() + 1).padStart(2, "0");
          const day = String(dateTime.getDate()).padStart(2, "0");
          const hour = String(dateTime.getHours()).padStart(2, "0");
          const minute = String(dateTime.getMinutes()).padStart(2, "0");
          return {
            date: `${year}-${month}-${day}`,
            time: `${hour}:${minute}`,
          };
        }
      } catch (error) {
        console.warn("[02-Seats] startTime 파싱 실패:", error);
      }
    }
    return { date: "", time: "" };
  }, [roomInfo.startTime]);

  // URL 파라미터에서 날짜와 시간 정보 가져오기 (없으면 기본값 사용)
  const dateParam = searchParams.get("date") || defaultDateTime.date;
  const timeParam = searchParams.get("time") || defaultDateTime.time;
  const roundParam = searchParams.get("round");

  // 선택 가능한 날짜 목록 생성 (오늘부터 3일)
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const availableDates: Date[] = [];
  for (let i = 0; i < 3; i++) {
    const date = new Date(todayStart);
    date.setDate(todayStart.getDate() + i);
    availableDates.push(date);
  }

  // 시간 포맷팅 (12:00 -> 12시 00분)
  const formatTime = (timeStr: string) => {
    const [hour, minute] = timeStr.split(":");
    return `${hour}시 ${minute}분`;
  };

  // 날짜 포맷팅
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
    return `${year}년 ${month}월 ${day}일(${weekday})`;
  };

  // 요일에 따른 드롭다운 option 색상 (토: 파란색, 일: 빨간색)
  const getDateOptionStyle = (date: Date): CSSProperties => {
    const day = date.getDay(); // 0: 일요일, 6: 토요일
    if (day === 0) return { color: "#d32f2f" }; // 일요일: 빨간색
    if (day === 6) return { color: "#1e3a8a" }; // 토요일: 파란색
    return {};
  };

  // 시간 목록 (startTime에서 추출한 시간 사용, 없으면 기본값)
  const availableTimes: string[] = defaultDateTime.time
    ? [defaultDateTime.time]
    : ["12:00"];

  // 시간 placeholder 라벨
  const timePlaceholderLabel = "선택하세요!";
  // 좌석 클릭 차단 여부 (둘 중 하나라도 비어있으면 차단)
  const isSeatBlocked = dateParam === "" || timeParam === "";

  // 선택된 날짜 기준으로 시간 옵션 색상 지정 (토: 파랑, 일: 빨강)
  const getTimeOptionStyle = (): CSSProperties => {
    if (!dateParam) return {};
    const d = new Date(dateParam + "T00:00:00");
    const day = d.getDay(); // 0: 일, 6: 토
    if (day === 0) return { color: "#d32f2f" };
    if (day === 6) return { color: "#1e3a8a" };
    return {};
  };
  // 다른 날짜 선택 핸들러
  const handleDateChange = (dateStr: string) => {
    const url = new URL(window.location.href);
    if (dateStr === "") {
      url.searchParams.delete("date");
      // 일자 placeholder를 선택하면 시간도 placeholder로 초기화
      url.searchParams.delete("time");
    } else {
      url.searchParams.set("date", dateStr);
    }
    navigate(url.pathname + url.search, { replace: true });
  };

  // 시간 선택 핸들러
  const handleTimeChange = (timeStr: string) => {
    const url = new URL(window.location.href);
    if (timeStr === "") url.searchParams.delete("time");
    else url.searchParams.set("time", timeStr);
    navigate(url.pathname + url.search, { replace: true });
  };

  // 좌석 차단 시 현재 선택 좌석 초기화
  useEffect(() => {
    if (isSeatBlocked) {
      setSelected((prev) => (prev.length > 0 ? [] : prev));
    }
  }, [isSeatBlocked]);

  // const totalPrice = useMemo(
  //   () => selected.reduce((sum, s) => sum + (s.price ?? 0), 0),
  //   [selected]
  // );

  const clearSelection = () => {
    setSelected([]);
  };
  const goPrev = () => {
    const url = new URL(window.location.origin + paths.booking.selectSchedule);
    // hallId가 있으면 전달
    if (hallId) url.searchParams.set("hallId", String(hallId));
    navigate(url.pathname + url.search);
  };
  // 이미 선택한 좌석 알림 표시 횟수는 실제 좌석 모듈/서버 응답에서 모달을 띄울 때 setShowSeatTakenAlert(true)와 setSeatTakenAlertCount를 함께 호출합니다.

  const matchIdFromStore = useMatchStore((s) => s.matchId);
  const currentUserId = useAuthStore((s) => s.userId);
  const wsClient = useWebSocketStore((s) => s.client);
  const wsSubscriptionRef = useRef<Subscription | null>(null);

  // 좌석 선택 단계에서 창을 닫는 경우에도 실패 통계 전송 시도
  useSeatStatsFailedOnUnload("02-Seats");

  // MATCH_ENDED 이벤트 처리: 아직 좌석 홀드/결제 확정 전에 경기가 종료된 경우
  useEffect(() => {
    const roomId = useRoomStore.getState().roomInfo?.roomId;
    if (!roomId) {
      return;
    }
    if (!wsClient) {
      if (import.meta.env.DEV) {
        console.warn("[02-Seats][ws] WebSocket 클라이언트가 없습니다.");
      }
      return;
    }

    const destination = `/topic/rooms/${roomId}`;
    let retryCount = 0;
    const maxRetries = 20;

    const handleMessage = (msg: { body: string }) => {
      try {
        const data = JSON.parse(msg.body) as {
          eventType?: string;
          type?: string;
          payload?: { matchId?: number | string };
        };
        const evtType = data.eventType || data.type;
        if (evtType !== "MATCH_ENDED") {
          return;
        }

        // matchId: 이벤트 payload → store → URL 순으로 결정
        const payloadMatchId = data.payload?.matchId;
        const qs = new URLSearchParams(window.location.search);
        const qsMatchId = qs.get("matchId");
        const storeMatchId = useMatchStore.getState().matchId;

        const resolvedMatchIdRaw =
          payloadMatchId ??
          (qsMatchId != null && !Number.isNaN(Number(qsMatchId))
            ? Number(qsMatchId)
            : storeMatchId);

        // 통계 전송 (helper 내부에서 userId/matchId/중복 여부 모두 검사)
        (async () => {
          try {
            await sendSeatStatsFailedForMatch(resolvedMatchIdRaw, {
              trigger: "MATCH_ENDED@02-Seats",
            });
          } finally {
            // 알림 후 결과 페이지로 이동
            alert("경기가 종료되었습니다.\n\n결과 화면으로 이동합니다.");
            const metricsQs = buildMetricsQueryFromStorage();
            const prefix = metricsQs ? `${metricsQs}&` : "?";
            const target = paths.booking.gameResult + `${prefix}failed=true`;
            window.location.replace(target);
          }
        })();
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error("[02-Seats][MATCH_ENDED] 메시지 파싱 실패:", e);
        }
      }
    };

    const trySubscribe = () => {
      if (wsClient.connected) {
        const sub = subscribe(wsClient, destination, (message) =>
          handleMessage(
            message as unknown as {
              body: string;
            }
          )
        );
        if (sub) {
          wsSubscriptionRef.current = sub;
          if (import.meta.env.DEV) {
            console.log("[02-Seats][ws] MATCH_ENDED 구독 성공:", destination);
          }
        }
        return;
      }
      retryCount += 1;
      if (retryCount <= maxRetries) {
        setTimeout(trySubscribe, 500);
      } else if (import.meta.env.DEV) {
        console.error(
          "[02-Seats][ws] MATCH_ENDED 구독 실패: WebSocket 연결 시간 초과"
        );
      }
    };

    trySubscribe();

    return () => {
      if (wsSubscriptionRef.current) {
        wsSubscriptionRef.current.unsubscribe();
        wsSubscriptionRef.current = null;
      }
    };
  }, [wsClient]);
  // TAKEN 좌석 정보 저장 (SmallVenue용, section-row-col 형식)
  const [takenSeats, setTakenSeats] = useState<Set<string>>(new Set());

  // AI 공연장 섹션 선택 상태
  const [selectedAISection, setSelectedAISection] = useState<{
    sectionId: string;
    grade: string;
    totalRows: number;
    totalCols: number;
    fillColor: string;
  } | null>(null);
  // AI 공연장 섹션별 TAKEN 좌석 정보 (sectionId-row-col 형식)
  const [aiTakenSeats, setAITakenSeats] = useState<Set<string>>(new Set());

  // AI 공연장 SVG polygon 클릭 이벤트 처리
  // selectedAISection이 null일 때만 SVG 전체 보기가 표시되므로 이때만 리스너 추가
  useEffect(() => {
    if (!isAIGenerated || !tsxUrl || selectedAISection !== null) return;

    const handlePolygonClick = async (e: MouseEvent) => {
      const target = e.target as SVGPolygonElement | null;
      console.log("[AI-section-click] 클릭 이벤트 발생:", {
        target,
        tagName: target?.tagName,
        isPolygon: target?.tagName === "polygon",
      });

      if (!target || target.tagName !== "polygon") {
        console.log("[AI-section-click] polygon이 아닙니다:", target?.tagName);
        return;
      }

      const sectionId = target.getAttribute("section");
      const grade = target.getAttribute("grade") || "";
      // React는 DOM 요소에 커스텀 prop을 허용하지 않으므로 data- 접두사나 소문자 속성도 시도
      const totalRowsStr =
        target.getAttribute("totalRows") ||
        target.getAttribute("data-total-rows") ||
        target.getAttribute("totalrows");
      const totalColsStr =
        target.getAttribute("totalCols") ||
        target.getAttribute("data-total-cols") ||
        target.getAttribute("totalcols");
      const fillColor = target.getAttribute("fill") || "#CF0098";

      console.log("[AI-section-click] polygon 속성:", {
        sectionId,
        grade,
        totalRowsStr,
        totalColsStr,
        fillColor,
        allAttributes: Array.from(target.attributes).map((attr) => ({
          name: attr.name,
          value: attr.value,
        })),
      });

      if (!sectionId || !totalRowsStr || !totalColsStr) {
        console.warn("[AI-section-click] 섹션 정보가 불완전합니다:", {
          sectionId,
          grade,
          totalRowsStr,
          totalColsStr,
        });
        return;
      }

      const totalRows = Number(totalRowsStr);
      const totalCols = Number(totalColsStr);

      if (Number.isNaN(totalRows) || Number.isNaN(totalCols)) {
        console.warn(
          "[AI-section-click] totalRows 또는 totalCols가 숫자가 아닙니다:",
          {
            totalRowsStr,
            totalColsStr,
          }
        );
        return;
      }

      console.log("[AI-section-click] 섹션 클릭 성공:", {
        sectionId,
        grade,
        totalRows,
        totalCols,
        fillColor,
      });

      // 섹션 선택
      setSelectedAISection({
        sectionId,
        grade,
        totalRows,
        totalCols,
        fillColor,
      });

      // 해당 섹션의 좌석 현황 조회
      if (matchIdFromStore && currentUserId) {
        try {
          const response = await getSectionSeatsStatus(
            matchIdFromStore,
            sectionId,
            currentUserId
          );
          console.log("[AI-section-click] 섹션 좌석 현황:", response);

          const taken = new Set<string>();
          if (response.seats) {
            response.seats.forEach((seat) => {
              if (seat.status === "TAKEN" || seat.status === "MY_RESERVED") {
                // API 응답의 seatId를 그대로 사용 (sectionId-row-col 형식)
                taken.add(seat.seatId);
              }
            });
          }
          setAITakenSeats(taken);
          console.log(
            "[AI-section-click] TAKEN 좌석 저장:",
            Array.from(taken),
            `(총 ${taken.size}개)`
          );
        } catch (error) {
          console.error(
            `[AI-section-click] 섹션 ${sectionId} 좌석 현황 조회 실패:`,
            error
          );
        }
      }
    };

    // SVG 요소가 렌더링될 때까지 대기
    const checkAndAttachListener = () => {
      // TsxPreview가 렌더링하는 SVG를 찾기 위해 더 구체적으로 검색
      const container =
        document.getElementById("ai-venue-container") ||
        document.querySelector('[class*="w-[600px]"]');
      const svgElement =
        container?.querySelector("svg") || document.querySelector("svg");

      if (svgElement) {
        // 이미 리스너가 추가되었는지 확인
        const hasListener = svgElement.hasAttribute(
          "data-ai-listener-attached"
        );
        if (hasListener) {
          return true; // 이미 추가됨
        }

        console.log("[AI-section-click] SVG 요소 찾음, 이벤트 리스너 추가");
        const polygons = svgElement.querySelectorAll("polygon");
        console.log("[AI-section-click] 발견된 polygon 개수:", polygons.length);

        if (polygons.length === 0) {
          // polygon이 아직 렌더링되지 않았을 수 있으므로 경고 제거
          return false;
        }

        // 각 polygon에 직접 이벤트 리스너 추가 (이벤트 위임 대신)
        polygons.forEach((polygon) => {
          polygon.addEventListener("click", handlePolygonClick);
          polygon.style.cursor = "pointer";
          // 탭 효과(아웃라인) 제거
          polygon.style.outline = "none";
          // pointer-events가 none으로 설정되어 있을 수 있으므로 확인
          const pointerEvents = window.getComputedStyle(polygon).pointerEvents;
          if (pointerEvents === "none") {
            polygon.style.pointerEvents = "all";
          }
        });

        // SVG에도 이벤트 위임으로 추가 (백업)
        svgElement.addEventListener("click", handlePolygonClick);
        svgElement.setAttribute("data-ai-listener-attached", "true");
        return true;
      }
      return false;
    };

    // 즉시 확인
    if (checkAndAttachListener()) {
      return () => {
        const svgElement = document.querySelector("svg");
        if (svgElement) {
          svgElement.removeEventListener("click", handlePolygonClick);
          const polygons = svgElement.querySelectorAll("polygon");
          polygons.forEach((polygon) => {
            polygon.removeEventListener("click", handlePolygonClick);
          });
        }
      };
    }

    // SVG가 나중에 렌더링될 수 있으므로 MutationObserver 사용
    let retryCount = 0;
    const maxRetries = 50; // 최대 5초 대기 (100ms * 50)

    const observer = new MutationObserver(() => {
      retryCount++;
      if (checkAndAttachListener()) {
        console.log(
          `[AI-section-click] SVG 찾음 (시도 ${retryCount}회), observer 해제`
        );
        observer.disconnect();
        if (intervalId) clearInterval(intervalId);
      } else if (retryCount >= maxRetries) {
        // 경고는 제거 - 정상적인 경우에도 발생할 수 있음
        observer.disconnect();
        if (intervalId) clearInterval(intervalId);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 주기적으로도 확인 (MutationObserver가 놓칠 수 있음)
    let intervalId: ReturnType<typeof setInterval> | null = null;
    intervalId = setInterval(() => {
      if (checkAndAttachListener()) {
        if (intervalId) clearInterval(intervalId);
        observer.disconnect();
      }
    }, 100);

    return () => {
      if (intervalId) clearInterval(intervalId);
      observer.disconnect();
      const svgElement = document.querySelector("svg");
      if (svgElement) {
        svgElement.removeEventListener("click", handlePolygonClick);
        svgElement.removeAttribute("data-ai-listener-attached");
        const polygons = svgElement.querySelectorAll("polygon");
        polygons.forEach((polygon) => {
          polygon.removeEventListener("click", handlePolygonClick);
        });
      }
    };
  }, [
    isAIGenerated,
    tsxUrl,
    matchIdFromStore,
    currentUserId,
    selectedAISection,
  ]);

  // SmallVenue의 경우 모든 섹션에 대해 TAKEN 좌석 조회
  useEffect(() => {
    if (venueKey !== "small" || !matchIdFromStore || !currentUserId) return;

    const fetchAllSections = async () => {
      const allTaken = new Set<string>();
      // SmallVenue의 섹션: 1, 2, 3 (1층), 4, 5, 6 (2층)
      const sections = ["1", "2", "3", "4", "5", "6"];

      for (const sectionId of sections) {
        try {
          const response = await getSectionSeatsStatus(
            matchIdFromStore,
            sectionId,
            currentUserId
          );
          if (response.seats) {
            response.seats.forEach((seat) => {
              // TAKEN 또는 MY_RESERVED 상태인 좌석은 선택할 수 없음
              if (seat.status === "TAKEN" || seat.status === "MY_RESERVED") {
                allTaken.add(seat.seatId);
              }
            });
          }
        } catch (error) {
          console.error(`[seat-status] 섹션 ${sectionId} 조회 실패:`, error);
        }
      }

      setTakenSeats(allTaken);
      console.log(
        "[seat-status] SmallVenue TAKEN 좌석 저장:",
        Array.from(allTaken)
      );
    };

    fetchAllSections();
  }, [venueKey, matchIdFromStore, currentUserId]);

  const complete = async () => {
    const durationSec = recordSeatCompleteNow();
    console.log("[ReserveTiming] Seat complete", {
      durationFromCaptchaSec: durationSec,
      captchaBackspaces,
      captchaWrongAttempts,
      seatClickMissCount,
      seatTakenAlertCount,
    });

    // 좌석 선택 완료 시 API 호출
    if (selected.length > 0) {
      // matchId 결정: store 우선, 없으면 URL 파라미터에서 가져오기
      const matchIdParam = searchParams.get("matchId");
      const matchId =
        matchIdFromStore ??
        (matchIdParam && !Number.isNaN(Number(matchIdParam))
          ? Number(matchIdParam)
          : null);

      if (matchId && currentUserId) {
        try {
          // 선택한 좌석들의 정보를 DOM에서 가져오기
          const seats: Array<{
            sectionId: number;
            row: number;
            col: number;
            grade: string;
          }> = [];

          // 공연장 종류 확인 (올림픽홀, 인스파이어 아레나는 medium/large)
          const isMediumOrLargeVenue =
            venueName === "OlympicHall" || venueName === "InspireArena";

          selected.forEach((seat) => {
            // 좌석 DIV에서 커스텀 속성 읽기 (신규 속성 seatid, 호환용 data-seat-id)
            let seatElement = document.querySelector(
              `[seatid="${seat.id}"]`
            ) as HTMLElement | null;
            if (!seatElement) {
              seatElement = document.querySelector(
                `[data-seat-id="${seat.id}"]`
              ) as HTMLElement | null;
            }

            // seatid로 찾지 못하면 data-seat-id로 시도
            if (!seatElement) {
              seatElement = document.querySelector(
                `[data-seat-id="${seat.id}"]`
              ) as HTMLElement | null;
            }

            if (seatElement) {
              const sectionId =
                seatElement.getAttribute("data-section") ??
                seatElement.getAttribute("section");
              const row =
                seatElement.getAttribute("data-row") ??
                seatElement.getAttribute("row");
              const grade =
                seatElement.getAttribute("data-grade") ??
                seatElement.getAttribute("grade");
              const active =
                seatElement.getAttribute("data-active") ??
                seatElement.getAttribute("active");

              // 올림픽홀/인스파이어 아레나는 seat 속성 사용 (섹션 내 좌석 번호)
              // 샤롯데와 AI 공연장은 col 속성 사용
              let colValue: string | null;
              if (isMediumOrLargeVenue) {
                colValue = seatElement.getAttribute("seat"); // 섹션 내 좌석 번호
              } else {
                // AI 공연장과 샤롯데는 data-col 속성 사용
                colValue =
                  seatElement.getAttribute("data-col") ??
                  seatElement.getAttribute("col"); // 절대 열 번호
              }

              if (sectionId && row && colValue && grade && active === "1") {
                const seatData = {
                  sectionId: Number(sectionId),
                  row: Number(row),
                  col: Number(colValue),
                  grade: grade,
                };
                seats.push(seatData);
                console.log(`[seat-hold] 좌석 정보 추출:`, {
                  seatId: seat.id,
                  elementAttributes: {
                    section: sectionId,
                    row: row,
                    col: colValue,
                    seat: seatElement.getAttribute("seat"),
                    grade: grade,
                    active: active,
                  },
                  extractedData: seatData,
                });
              } else {
                console.warn(`[seat-hold] 좌석 정보 불완전:`, {
                  seatId: seat.id,
                  sectionId,
                  row,
                  col: colValue,
                  grade,
                  active,
                  isMediumOrLargeVenue,
                });
              }
            } else {
              console.warn(`[seat-hold] 좌석 요소를 찾을 수 없음:`, {
                seatId: seat.id,
                triedSelectors: [
                  `[seatid="${seat.id}"]`,
                  `[data-seat-id="${seat.id}"]`,
                ],
                venueName,
                isMediumOrLargeVenue,
                // DOM에서 실제로 존재하는 좌석 요소들 확인
                allSeatIds: Array.from(
                  document.querySelectorAll("[seatid], [data-seat-id]")
                ).map((el) => ({
                  seatid: el.getAttribute("seatid"),
                  dataSeatId: el.getAttribute("data-seat-id"),
                })),
              });
            }
          });

          // totalSeats 가져오기 (roomStore에서 가져오기)
          const totalSeats = roomInfo.totalSeat ?? 100; // roomStore에서 가져오거나 기본값 100 사용

          if (seats.length > 0) {
            const requestPayload = {
              userId: currentUserId,
              seats,
              totalSeats,
            };
            console.log("[seat-hold] API 요청:", {
              matchId,
              url: `/ticketing/matches/${matchId}/hold`,
              payload: requestPayload,
              venueName,
              isMediumOrLargeVenue:
                venueName === "OlympicHall" || venueName === "InspireArena",
            });

            const response = await holdSeat(matchId, requestPayload);

            console.log("[seat-hold] API 응답:", {
              status: response.status,
              body: response.body,
              success: response.body.success,
              heldSeats: response.body.heldSeats,
              failedSeats: response.body.failedSeats,
            });

            // 409 응답 또는 실패한 좌석이 있는 경우
            if (
              response.status === 409 ||
              !response.body.success ||
              (response.body.failedSeats &&
                response.body.failedSeats.length > 0)
            ) {
              console.warn("[seat-hold] 좌석 선점 실패 - 이미 선택된 좌석");

              // 선택한 좌석들의 섹션 ID 추출 (중복 제거)
              const sectionIds = Array.from(
                new Set(seats.map((seat) => String(seat.sectionId)))
              );

              console.log("[seat-hold] 섹션 좌석 현황 새로고침:", sectionIds);

              // 각 섹션의 좌석 현황을 다시 가져오기
              if (matchId && currentUserId) {
                if (isAIGenerated) {
                  // AI 공연장: 선택한 좌석들의 섹션 좌석 현황 가져오기
                  const allTaken = new Set<string>();

                  for (const sectionId of sectionIds) {
                    try {
                      const statusResponse = await getSectionSeatsStatus(
                        matchId,
                        sectionId,
                        currentUserId
                      );
                      console.log(
                        `[seat-hold] AI 공연장 섹션 ${sectionId} 좌석 현황:`,
                        statusResponse
                      );

                      if (statusResponse.seats) {
                        statusResponse.seats.forEach((seat) => {
                          if (
                            seat.status === "TAKEN" ||
                            seat.status === "MY_RESERVED"
                          ) {
                            allTaken.add(seat.seatId);
                          }
                        });
                      }
                    } catch (error) {
                      console.error(
                        `[seat-hold] AI 공연장 섹션 ${sectionId} 좌석 현황 조회 실패:`,
                        error
                      );
                    }
                  }

                  setAITakenSeats(allTaken);
                  console.log(
                    "[seat-hold] AI 공연장 TAKEN 좌석 업데이트:",
                    Array.from(allTaken)
                  );
                } else if (venueKey === "small") {
                  // SmallVenue: 모든 섹션의 좌석 현황 가져오기
                  const allTaken = new Set<string>();
                  const sections = ["1", "2", "3", "4", "5", "6"];

                  for (const sectionId of sections) {
                    try {
                      const statusResponse = await getSectionSeatsStatus(
                        matchId,
                        sectionId,
                        currentUserId
                      );
                      if (statusResponse.seats) {
                        statusResponse.seats.forEach((seat) => {
                          if (seat.status === "TAKEN") {
                            allTaken.add(seat.seatId);
                          }
                        });
                      }
                    } catch (error) {
                      console.error(
                        `[seat-hold] 섹션 ${sectionId} 좌석 현황 조회 실패:`,
                        error
                      );
                    }
                  }

                  setTakenSeats(allTaken);
                  console.log(
                    "[seat-hold] SmallVenue TAKEN 좌석 업데이트:",
                    Array.from(allTaken)
                  );
                } else {
                  // MediumVenue/LargeVenue: 해당 섹션들의 좌석 현황 가져오기
                  const venueRef =
                    venueKey === "medium" ? mediumVenueRef : largeVenueRef;

                  for (const sectionId of sectionIds) {
                    try {
                      // 섹션 좌석 현황 API 호출
                      const statusResponse = await getSectionSeatsStatus(
                        matchId,
                        sectionId,
                        currentUserId
                      );
                      console.log(
                        `[seat-hold] 섹션 ${sectionId} 좌석 현황:`,
                        statusResponse
                      );

                      // TAKEN 또는 MY_RESERVED 좌석 ID 추출
                      // MY_RESERVED는 다른 사용자가 예약한 좌석이므로 선택할 수 없음
                      const takenSeatIds: string[] = [];
                      if (statusResponse.seats) {
                        statusResponse.seats.forEach((seat) => {
                          if (
                            seat.status === "TAKEN" ||
                            seat.status === "MY_RESERVED"
                          ) {
                            takenSeatIds.push(seat.seatId);
                          }
                        });
                      }

                      // ref를 통해 컴포넌트의 좌석 상태 직접 업데이트
                      if (venueRef?.current?.refreshSeatStatus) {
                        venueRef.current.refreshSeatStatus(
                          sectionId,
                          takenSeatIds
                        );
                        console.log(
                          `[seat-hold] 섹션 ${sectionId} 좌석 상태 업데이트 완료:`,
                          takenSeatIds.length,
                          "개"
                        );
                      } else {
                        console.warn(
                          `[seat-hold] venueRef 또는 refreshSeatStatus를 찾을 수 없음`
                        );
                      }
                    } catch (error) {
                      console.error(
                        `[seat-hold] 섹션 ${sectionId} 좌석 현황 조회 실패:`,
                        error
                      );
                    }
                  }
                }
              }

              // 선택된 좌석 초기화
              setSelected([]);
              // 알림 표시
              setShowSeatTakenAlert(true);
              _setSeatTakenAlertCount((prev) => prev + 1);
              // 다음 페이지로 이동하지 않고 현재 페이지에 머물기
              return;
            }

            // 성공한 경우에만 다음 페이지로 이동
            console.log("[seat-hold] 좌석 선점 성공, 다음 페이지로 이동");
          } else {
            console.warn(
              "[seat-hold] 좌석 정보를 찾을 수 없어 API 호출을 건너뜁니다."
            );
            return;
          }
        } catch (error) {
          console.error("[seat-hold] API 호출 실패:", error);
          // 에러 발생 시에도 알림 표시하고 현재 페이지에 머물기
          setSelected([]);
          setShowSeatTakenAlert(true);
          _setSeatTakenAlertCount((prev) => prev + 1);
          return;
        }
      } else {
        console.warn(
          "[seat-hold] matchId 또는 userId가 없어 API 호출을 건너뜁니다.",
          { matchId, currentUserId }
        );
        return;
      }
    }

    // API 호출이 성공한 경우에만 다음 페이지로 이동
    sessionStorage.setItem("reserve.capBackspaces", String(captchaBackspaces));
    sessionStorage.setItem("reserve.capWrong", String(captchaWrongAttempts));
    const nextUrl = new URL(window.location.origin + paths.booking.price);
    if (durationSec != null)
      nextUrl.searchParams.set("capToCompleteSec", String(durationSec));
    nextUrl.searchParams.set("capBackspaces", String(captchaBackspaces));
    nextUrl.searchParams.set("capWrong", String(captchaWrongAttempts));
    // 보안문자 입력 이후 클릭 실수 전달
    nextUrl.searchParams.set("seatClickMiss", String(seatClickMissCount));
    sessionStorage.setItem("reserve.seatClickMiss", String(seatClickMissCount));
    // 이미 선택한 좌석 알림 표시 횟수 전달
    nextUrl.searchParams.set("seatTakenCount", String(seatTakenAlertCount));
    sessionStorage.setItem(
      "reserve.seatTakenCount",
      String(seatTakenAlertCount)
    );
    const rt =
      searchParams.get("rtSec") ?? sessionStorage.getItem("reserve.rtSec");
    const nrc =
      searchParams.get("nrClicks") ??
      sessionStorage.getItem("reserve.nrClicks");
    if (rt) nextUrl.searchParams.set("rtSec", rt);
    if (nrc) nextUrl.searchParams.set("nrClicks", nrc);
    const cap = sessionStorage.getItem("reserve.captchaDurationSec");
    if (cap) nextUrl.searchParams.set("captchaSec", cap);
    // 날짜와 회차 정보 전달
    if (dateParam) nextUrl.searchParams.set("date", dateParam);
    if (timeParam) nextUrl.searchParams.set("time", timeParam);
    if (roundParam) nextUrl.searchParams.set("round", roundParam);
    // 선택한 좌석 정보 전달 (등급별로 그룹화)
    const seatsByGrade = selected.reduce(
      (acc, seat) => {
        const grade = seat.gradeLabel;
        if (!acc[grade]) {
          acc[grade] = { count: 0, price: seat.price ?? 0, seats: [] };
        }
        acc[grade].count += 1;
        acc[grade].seats.push({
          gradeLabel: seat.gradeLabel,
          label: seat.label,
        });
        return acc;
      },
      {} as Record<
        string,
        {
          count: number;
          price: number;
          seats: Array<{ gradeLabel: string; label: string }>;
        }
      >
    );
    const seatsData = Object.entries(seatsByGrade).map(([grade, data]) => ({
      grade,
      count: data.count,
      price: data.price,
      seats: data.seats,
    }));
    if (seatsData.length > 0) {
      nextUrl.searchParams.set("seats", JSON.stringify(seatsData));
    }
    navigate(nextUrl.pathname + nextUrl.search);
  };

  // dateParam 또는 timeParam이 없고 기본값이 있으면 URL에 추가
  // 이전 단계로 돌아갔다가 다시 돌아와도 기본값 유지
  useEffect(() => {
    const currentDate = searchParams.get("date");
    const currentTime = searchParams.get("time");

    // 둘 다 있으면 업데이트 불필요
    if (currentDate && currentTime) return;

    // 하나라도 없고 기본값이 있으면 URL에 추가
    if (
      (!currentDate && defaultDateTime.date) ||
      (!currentTime && defaultDateTime.time)
    ) {
      const url = new URL(window.location.href);
      let shouldUpdate = false;

      if (!currentDate && defaultDateTime.date) {
        url.searchParams.set("date", defaultDateTime.date);
        shouldUpdate = true;
      }
      if (!currentTime && defaultDateTime.time) {
        url.searchParams.set("time", defaultDateTime.time);
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        navigate(url.pathname + url.search, { replace: true });
      }
    }
  }, [searchParams, defaultDateTime.date, defaultDateTime.time, navigate]);

  useEffect(() => {
    // 팝업 크기 보정만 수행 (스크롤은 숨기지 않음)
    if (typeof window.resizeTo === "function") {
      window.resizeTo(920, 750);
    }

    const rtSec = searchParams.get("rtSec");
    const nrClicks = searchParams.get("nrClicks");
    const tStart = searchParams.get("tStart");
    console.log("[ReserveTiming] Captcha input stage", {
      reactionSec: rtSec ? Number(rtSec) : null,
      nonReserveClickCount: nrClicks ? Number(nrClicks) : null,
    });
    saveInitialReaction(rtSec, nrClicks);
    // 총 시간 시작 시각 전달 받으면 저장 (없으면 초기 진입 시점으로 설정)
    if (tStart && !Number.isNaN(Number(tStart))) {
      setTotalStartAtMs(Number(tStart));
    } else if (!sessionStorage.getItem("reserve.totalStartAtMs")) {
      setTotalStartAtMs();
    }
  }, [searchParams]);

  return (
    <Viewport>
      <CaptchaModal
        open={showCaptcha}
        onVerify={(durationMs, { backspaceCount, wrongAttempts }) => {
          const sec = Math.round(durationMs) / 1000;
          setCaptchaBackspaces(backspaceCount);
          setCaptchaWrongAttempts(wrongAttempts);
          setCaptchaEndNow(sec, backspaceCount, wrongAttempts);
          // 캡챠 통과 시 room store에 true로 저장
          setCaptchaPassed(true);
          console.log("[ReserveTiming] Captcha verified", {
            captchaSec: sec,
            backspaceCount,
            wrongAttempts,
          });
          setShowCaptcha(false);
          // 보안문자 통과 후 클릭 실수 추적 시작
          setIsTrackingSeatClicks(true);
          setSeatClickMissCount(0);
        }}
        onReselect={goPrev}
      />
      <SeatTakenAlert
        open={showSeatTakenAlert}
        onClose={() => {
          setShowSeatTakenAlert(false);
        }}
      />
      {/* 고정 레이아웃 컨테이너: 전체 900 x 670 */}
      <div className="mx-auto w-[880px] h-[670px]">
        {/* 헤더 900 x 50 */}
        <div className="w-[880px] h-[50px] bg-[linear-gradient(to_bottom,#f2f2f2,#dbdbdb)] border-b border-[#bdbdbd]">
          <div className="h-full flex items-center gap-3">
            <div className="flex items-center bg-[linear-gradient(to_bottom,#4383fb,#104bb7)] text-white rounded-none px-12 h-12.5">
              <span className="text-[#ffcc33] font-extrabold text-[18px] rounded-full w-6 h-6 flex items-center justify-center mr-2">
                02/
              </span>
              <span className="text-md font-semibold">좌석 선택</span>
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-bold text-[#222]">
                {eventTitle}
                <span className="text-[12px] text-gray-400 ml-5">
                  | {venueName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#555]">
                <span>› 다른 관람일자 선택 :</span>
                <span>일자</span>
                <label htmlFor="dateSel" className="sr-only">
                  일자
                </label>
                <select
                  id="dateSel"
                  className="border border-[#cfcfcf] rounded px-1 py-0.5 bg-white"
                  value={dateParam}
                  onChange={(e) => handleDateChange(e.target.value)}
                >
                  <option value="">선택하세요!</option>
                  {availableDates.map((date) => {
                    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
                    return (
                      <option
                        key={dateStr}
                        value={dateStr}
                        style={getDateOptionStyle(date)}
                      >
                        {formatDate(date)}
                      </option>
                    );
                  })}
                </select>
                <span>시간</span>
                <label htmlFor="timeSel" className="sr-only">
                  시간
                </label>
                <select
                  id="timeSel"
                  className="border border-[#cfcfcf] rounded px-1 py-0.5 bg-white"
                  value={timeParam}
                  onChange={(e) => handleTimeChange(e.target.value)}
                >
                  <option value="">{timePlaceholderLabel}</option>
                  {availableTimes.map((t) => (
                    <option key={t} value={t} style={getTimeOptionStyle()}>
                      {formatTime(t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* 상단 우측 부가 버튼 제거 (예매대기 불필요) */}
          </div>
        </div>
        {/* 본문 880 x 680 (내부 좌우 10 마진 → 880폭) */}
        <div className="w-[880px] h-[610px]">
          <div className="mx-[10px] h-full flex gap-2">
            {/* 좌측: 좌석 영역 660 x 620 */}
            <div
              className="w-[640px] h-[620px] shadow overflow-hidden p-0 bg-transparent"
              style={
                venueKey === "small"
                  ? {
                      backgroundImage:
                        "url(/performance-halls/charlotte-theater-background.jpg)",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                      backgroundSize: "contain",
                    }
                  : undefined
              }
            >
              {venueKey === "small" && !isAIGenerated && (
                <SmallVenue
                  selectedIds={selected.map((s) => s.id)}
                  takenSeats={takenSeats}
                  isPreset={!isAIGenerated}
                  onToggleSeat={(seat) => {
                    const price =
                      seat.price ?? getPriceByGradeLabel(seat.gradeLabel);
                    setSelected((prev) => {
                      const exists = prev.some((x) => x.id === seat.id);
                      if (exists) return prev.filter((x) => x.id !== seat.id);
                      if (prev.length >= 2) return prev;
                      return [
                        ...prev,
                        {
                          id: seat.id,
                          gradeLabel: seat.gradeLabel,
                          label: seat.label,
                          price,
                        },
                      ];
                    });
                  }}
                />
              )}
              {venueKey === "medium" && !isAIGenerated && (
                <MediumVenue
                  onBackToOverview={mediumVenueRef}
                  selectedIds={selected.map((s) => s.id)}
                  onToggleSeat={(seat) => {
                    const price =
                      seat.price ?? getPriceByGradeLabel(seat.gradeLabel);
                    setSelected((prev) => {
                      const exists = prev.some((x) => x.id === seat.id);
                      if (exists) return prev.filter((x) => x.id !== seat.id);
                      if (prev.length >= 2) return prev;
                      return [
                        ...prev,
                        {
                          id: seat.id,
                          gradeLabel: seat.gradeLabel,
                          label: seat.label,
                          price,
                        },
                      ];
                    });
                  }}
                />
              )}
              {venueKey === "large" && !isAIGenerated && (
                <LargeVenue
                  onBackToOverview={largeVenueRef}
                  selectedIds={selected.map((s) => s.id)}
                  onToggleSeat={(seat) => {
                    const price =
                      seat.price ?? getPriceByGradeLabel(seat.gradeLabel);
                    setSelected((prev) => {
                      const exists = prev.some((x) => x.id === seat.id);
                      if (exists) return prev.filter((x) => x.id !== seat.id);
                      if (prev.length >= 2) return prev;
                      return [
                        ...prev,
                        {
                          id: seat.id,
                          gradeLabel: seat.gradeLabel,
                          label: seat.label,
                          price,
                        },
                      ];
                    });
                  }}
                />
              )}
              {isAIGenerated ? (
                tsxUrl ? (
                  <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
                    {selectedAISection ? (
                      // 좌석 그리드 뷰
                      <div className="w-full h-full flex flex-col items-center justify-center p-4">
                        <div
                          className="grid gap-0.5 p-2 overflow-auto"
                          style={{
                            gridTemplateColumns: `repeat(${selectedAISection.totalCols}, minmax(0, 1fr))`,
                            maxWidth: "600px",
                            maxHeight: "580px",
                          }}
                        >
                          {Array.from({
                            length: selectedAISection.totalRows,
                          }).map((_, rowIndex) => {
                            const row = rowIndex + 1;
                            return Array.from({
                              length: selectedAISection.totalCols,
                            }).map((_, colIndex) => {
                              const col = colIndex + 1;
                              // CharlotteTheater와 동일한 형식: sectionId-row-col
                              const seatId = `${selectedAISection.sectionId}-${row}-${col}`;
                              // API 응답은 sectionId-row-col 형식이므로 동일하게 사용
                              const takenSeatId = seatId;
                              const isTaken = aiTakenSeats.has(takenSeatId);
                              const isSelected = selected.some(
                                (s) => s.id === seatId
                              );
                              const active = isTaken ? "0" : "1";

                              return (
                                <div
                                  key={`${row}-${col}`}
                                  data-seat-id={seatId}
                                  data-section={selectedAISection.sectionId}
                                  data-row={String(row)}
                                  data-col={String(col)}
                                  data-grade={selectedAISection.grade}
                                  data-active={active}
                                  onClick={() => {
                                    if (isTaken || isSeatBlocked) {
                                      console.log(
                                        "[AI-seat-click] 좌석 클릭 차단:",
                                        {
                                          isTaken,
                                          isSeatBlocked,
                                          seatId,
                                        }
                                      );
                                      return;
                                    }

                                    // grade 값 확인 및 사용
                                    const grade =
                                      selectedAISection.grade || "R";
                                    const sectionId =
                                      selectedAISection.sectionId;

                                    // 한글 레이블로 변환
                                    const gradeLabel =
                                      convertGradeToLabel(grade);
                                    const price =
                                      getPriceByGradeLabel(gradeLabel);

                                    console.log("[AI-seat-click] 좌석 클릭:", {
                                      seatId,
                                      grade,
                                      gradeLabel,
                                      sectionId,
                                      row,
                                      col,
                                      price,
                                    });

                                    setSelected((prev) => {
                                      const exists = prev.some(
                                        (x) => x.id === seatId
                                      );
                                      if (exists) {
                                        console.log(
                                          "[AI-seat-click] 좌석 해제:",
                                          seatId
                                        );
                                        return prev.filter(
                                          (x) => x.id !== seatId
                                        );
                                      }
                                      if (prev.length >= 2) {
                                        console.log(
                                          "[AI-seat-click] 최대 2개까지 선택 가능"
                                        );
                                        return prev;
                                      }

                                      // CharlotteTheater와 동일한 형식으로 저장
                                      const newSeat = {
                                        id: seatId,
                                        gradeLabel: gradeLabel, // "스탠딩", "R석", "S석", "A석", "VIP석"
                                        label: `${sectionId}구역-${row}열-${col}`, // "15구역-2열-46" 형식
                                        price,
                                      };

                                      console.log(
                                        "[AI-seat-click] 좌석 선택 완료:",
                                        newSeat,
                                        "이전 선택:",
                                        prev,
                                        "새로운 선택:",
                                        [...prev, newSeat]
                                      );

                                      return [...prev, newSeat];
                                    });
                                  }}
                                  className={`w-5 h-5 rounded border flex items-center justify-center text-xs cursor-pointer transition-all ${
                                    isTaken
                                      ? "bg-gray-400 cursor-not-allowed opacity-50"
                                      : isSelected
                                        ? "bg-gray-800 text-white"
                                        : ""
                                  }`}
                                  style={{
                                    backgroundColor: isTaken
                                      ? "#9ca3af"
                                      : isSelected
                                        ? "#4a4a4a"
                                        : selectedAISection.fillColor,
                                    borderColor: "#d1d5db", // light gray
                                  }}
                                  title={
                                    isTaken
                                      ? "이미 선택된 좌석"
                                      : `${selectedAISection.sectionId}구역-${row}열-${col}`
                                  }
                                />
                              );
                            });
                          })}
                        </div>
                      </div>
                    ) : (
                      // 전체 보기 (SVG)
                      <div
                        className="w-[600px] h-full flex items-center justify-center overflow-hidden"
                        id="ai-venue-container"
                      >
                        <TsxPreview
                          key={`seat-selection-${tsxUrl}`}
                          src={tsxUrl}
                          className="w-full h-full"
                          overflowHidden={true}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <p className="text-lg font-semibold">
                        AI 생성 좌석 배치도 로딩 중
                      </p>
                      <p className="text-sm mt-2">TSX URL이 없습니다.</p>
                    </div>
                  </div>
                )
              ) : null}
            </div>

            {/* 우측: 사이드 정보 220 x 620 */}
            <aside className="w-[220px] h-[620px] space-y-3">
              <SeatSidebarBanner
                hallId={hallId}
                venueKey={venueKey}
                mediumVenueRef={mediumVenueRef}
                largeVenueRef={largeVenueRef}
                onBackToOverview={() => {
                  // AI 공연장의 경우 섹션 선택 해제
                  if (isAIGenerated && selectedAISection) {
                    setSelectedAISection(null);
                  }
                }}
              />

              {/* 좌석등급 / 잔여석: 선택좌석 위로 이동 */}
              <div className="bg-white rounded-md border border-[#e3e3e3] shadow">
                <div className="px-3 py-2 font-semibold">좌석등급 / 가격</div>
                <div className="px-3 pb-3 text-xs">
                  <SeatGrades hallId={hallId} gradeMeta={GRADE_META} />
                </div>
              </div>

              <div className="bg-white rounded-md border border-[#e3e3e3] shadow">
                <div className="px-3 py-1.5 flex items-center justify-between">
                  <div className="font-semibold">선택좌석</div>
                  <div className="text-[#b02a2a] text-xs">
                    총 {selected.length}석 선택되었습니다.
                  </div>
                </div>
                <div className="p-2">
                  {/* Header with top/bottom divider */}
                  <table className="w-full text-sm">
                    <thead className="border-y border-gray-200">
                      <tr className="text-gray-500">
                        <th className="text-left font-normal w-24 whitespace-nowrap px-2">
                          좌석등급
                        </th>
                        <th className="text-left font-normal whitespace-nowrap px-2">
                          좌석번호
                        </th>
                      </tr>
                    </thead>
                  </table>
                  {/* Fixed-height, scrollable body */}
                  <div className="h-[160px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {selected.length === 0 ? (
                          <tr>
                            <td
                              colSpan={2}
                              className="text-center text-gray-400 py-8"
                            ></td>
                          </tr>
                        ) : (
                          selected.map((s) => (
                            <tr key={s.id} className="border-t border-gray-100">
                              <td className="py-1.5 whitespace-nowrap w-24 px-2">
                                {s.gradeLabel}
                              </td>
                              <td className="whitespace-nowrap px-2">
                                {s.label}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <button
                    disabled={selected.length === 0}
                    onClick={complete}
                    className="mt-2 w-full py-2.5 rounded font-bold bg-[linear-gradient(to_bottom,#4383fb,#104bb7)] text-white disabled:cursor-not-allowed"
                  >
                    <span className="inline-flex items-center gap-1">
                      좌석선택완료
                      <ArrowForwardIosIcon style={{ fontSize: 14 }} />
                    </span>
                  </button>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <button
                      onClick={goPrev}
                      className="flex-1 text-[12px] border border-[#9b9b9b] rounded px-1 py-2 bg-[linear-gradient(to_bottom,#f7f7f7,#e2e2e2)] hover:bg-[linear-gradient(to_bottom,#ededed,#d9d9d9)] inline-flex items-center justify-center gap-1 text-gray-700"
                    >
                      <ArrowBackIosNewIcon style={{ fontSize: 12 }} />
                      이전단계
                    </button>
                    <button
                      onClick={clearSelection}
                      className="flex-1 text-[12px] border border-[#9b9b9b] rounded px-1 py-2 bg-[linear-gradient(to_bottom,#f7f7f7,#e2e2e2)] hover:bg-[linear-gradient(to_bottom,#ededed,#d9d9d9)] inline-flex items-center justify-center gap-1 text-gray-700 cursor-pointer"
                    >
                      <RefreshIcon style={{ fontSize: 14 }} />
                      좌석 다시 선택
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </Viewport>
  );
}
