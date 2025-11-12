import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Collapse, IconButton } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PeopleIcon from "@mui/icons-material/People";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import { paths } from "../../../app/routes/paths";
import RoomSettingModal from "../../room/edit-room-setting/RoomSettingModal";
import StopwatchHUD from "./_components/StopwatchHUD";
import type {
  CreateRoomResponse,
  CreateRoomRequest,
  JoinRoomResponse,
  RoomDetailResponse,
  RoomMember,
} from "@features/room/types";
import dayjs from "dayjs";
import { useWebSocketStore } from "../../../shared/lib/websocket-store";
import { subscribe, type Subscription } from "../../../shared/lib/websocket";
import { useAuthStore } from "@features/auth/store";
import { exitRoom, getRoomDetail } from "@features/room/api";
import { useRoomStore } from "@features/room/store";
import { useMatchStore } from "@features/booking-site/store";
import { useNavigate } from "react-router-dom";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import Thumbnail01 from "../../../shared/images/thumbnail/Thumbnail01.webp";
import Thumbnail02 from "../../../shared/images/thumbnail/Thumbnail02.webp";
import Thumbnail03 from "../../../shared/images/thumbnail/Thumbnail03.webp";
import Thumbnail04 from "../../../shared/images/thumbnail/Thumbnail04.webp";
import Thumbnail05 from "../../../shared/images/thumbnail/Thumbnail05.webp";
import Thumbnail06 from "../../../shared/images/thumbnail/Thumbnail06.webp";
import {
  setTotalStartAtMs,
  getTotalStartAtMs,
} from "../../../shared/utils/reserveMetrics";

type Participant = {
  name: string;
  isHost?: boolean;
  avatarUrl?: string;
};

const BANNER_HIDE_KEY = "iticket.topBannerHideUntil";

// hallSize -> 사이즈 이름 매핑
const HALL_SIZE_TO_LABEL: Record<string, string> = {
  SMALL: "소형",
  MEDIUM: "중형",
  LARGE: "대형",
};

// difficulty -> 난이도 이름 매핑
const DIFFICULTY_TO_LABEL: Record<string, string> = {
  EASY: "쉬움",
  MEDIUM: "보통",
  HARD: "어려움",
};

type QueueStatus = {
  ahead: number;
  behind: number;
  total: number;
  lastUpdated: number;
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

// 썸네일 번호 -> 이미지 매핑
const THUMBNAIL_IMAGES: Record<string, string> = {
  "1": Thumbnail01,
  "2": Thumbnail02,
  "3": Thumbnail03,
  "4": Thumbnail04,
  "5": Thumbnail05,
  "6": Thumbnail06,
};

export default function ITicketPage() {
  const { roomId } = useParams<{ roomId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const roomData = location.state?.roomData as CreateRoomResponse | undefined;
  const roomRequest = location.state?.roomRequest as
    | CreateRoomRequest
    | undefined;
  const joinResponse = location.state?.joinResponse as
    | JoinRoomResponse
    | undefined;

  // 상세 응답 기반 표시값
  const [roomDetail, setRoomDetail] = useState<RoomDetailResponse | null>(null);

  // 게임 시작 시간 기반 카운트다운 계산
  // 게임 시작 시간의 30초 전부터 카운트다운 시작, 정확히 그 시간이 되면 버튼 활성화
  const calculateSecondsLeft = useCallback(() => {
    const gameStartTimeStr =
      roomDetail?.startTime || roomRequest?.gameStartTime;
    if (!gameStartTimeStr) {
      return 0; // 게임 시작 시간이 없으면 즉시 활성화
    }

    const gameStartTime = dayjs(gameStartTimeStr);
    const now = dayjs();
    const countdownStartTime = gameStartTime.subtract(30, "second"); // 30초 전

    // 게임 시작 시간이 이미 지났으면 즉시 활성화
    if (now.isAfter(gameStartTime)) {
      return 0;
    }

    // 카운트다운 시작 시간(게임 시작 시간 - 30초)이 아직 안 왔으면 대기
    // 이 경우 카운트다운 시작 시간까지의 시간을 반환 (30초 전까지는 카운트다운 안 함)
    if (now.isBefore(countdownStartTime)) {
      const diffSeconds = countdownStartTime.diff(now, "second");
      return diffSeconds + 30; // 카운트다운 시작 시간까지의 시간 + 30초 (30초 전부터 카운트다운 시작)
    }

    // 카운트다운 시작 시간이 지났으면 게임 시작 시간까지의 남은 시간 (30초부터 0초까지)
    const diffSeconds = gameStartTime.diff(now, "second");
    return Math.max(0, diffSeconds);
  }, [roomDetail?.startTime, roomRequest?.gameStartTime]);

  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    calculateSecondsLeft()
  );
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const [reserveAppearedAt, setReserveAppearedAt] = useState<number | null>(
    null
  );
  const [nonReserveClickCount, setNonReserveClickCount] = useState<number>(0);
  const [isTrackingClicks, setIsTrackingClicks] = useState<boolean>(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);
  const [showStopwatch, setShowStopwatch] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const subscriptionRef = useRef<Subscription | null>(null);
  const bridgeRef = useRef<BroadcastChannel | null>(null);
  const wsClient = useWebSocketStore((state) => state.client);
  const currentUserNickname = useAuthStore((state) => state.nickname);
  const currentUserId = useAuthStore((state) => state.userId);
  const matchIdFromStore = useMatchStore((s) => s.matchId);
  const [, setMyQueueStatus] = useState<QueueStatus | null>(null);

  // WebSocket 이벤트 핸들러
  const handleRoomEvent = useCallback(
    (event: {
      eventType?: string;
      type?: string; // 기존 형식 지원
      roomId?: number;
      timestamp?: number;
      message?: string;
      payload?: {
        userId?: number;
        username?: string;
        userName?: string; // 대문자 N 형식 지원
        totalUsersInRoom?: number;
        [key: string]: unknown;
      };
      roomMembers?: RoomMember[]; // 기존 형식 지원
      userId?: number; // 기존 형식 지원
      username?: string; // 기존 형식 지원
      userName?: string; // 대문자 N 형식 지원
      [key: string]: unknown;
    }) => {
      const eventType = event.eventType || event.type; // eventType 우선, 없으면 type
      const payload = event.payload;

      switch (eventType) {
        case "USER_DEQUEUED": {
          try {
            const myUserId = useAuthStore.getState().userId;
            const p = payload as
              | {
                  userId?: number;
                  matchId?: string | number;
                  timestamp?: number;
                }
              | undefined;

            if (!p || p.userId == null) {
              console.warn("⚠️ [DEQUEUE] payload.userId 가 없습니다:", event);
              break;
            }

            if (myUserId == null) {
              console.warn(
                "⚠️ [DEQUEUE] 사용자 ID를 확인할 수 없어 처리할 수 없습니다."
              );
              break;
            }

            if (p.userId === myUserId) {
              // 본인 성공
              if (p.matchId == null) {
                console.log("✅ [DEQUEUE] 본인 티켓팅 성공 (matchId 없음)", {
                  myUserId,
                  timestamp: p.timestamp ?? event.timestamp ?? Date.now(),
                });
              } else {
                // matchId는 store에 보관 (이후 단계에서 사용)
                const numericMatchId =
                  typeof p.matchId === "string" ? Number(p.matchId) : p.matchId;
                if (!Number.isNaN(numericMatchId)) {
                  useMatchStore.getState().setMatchId(numericMatchId as number);
                }
                console.log("✅ [DEQUEUE] 본인 티켓팅 성공!", {
                  myUserId,
                  matchId: p.matchId,
                  timestamp: p.timestamp ?? event.timestamp ?? Date.now(),
                  message: event.message,
                });
              }
            } else {
              // 타인 성공
              console.log("ℹ️ [DEQUEUE] 다른 유저 티켓팅 성공:", {
                dequeuedUserId: p.userId,
                myUserId,
                timestamp: p.timestamp ?? event.timestamp ?? Date.now(),
              });
            }
          } catch (e) {
            console.error("❌ [DEQUEUE] 처리 실패:", e, event);
          }
          break;
        }

        case "QUEUE_STATUS_UPDATE": {
          try {
            const myUserId = useAuthStore.getState().userId;
            const queueStatuses = (
              payload as { queueStatuses?: Record<string, unknown> }
            )?.queueStatuses;

            if (!queueStatuses) {
              console.warn(
                "⚠️ [QUEUE] payload.queueStatuses 가 없습니다:",
                event
              );
              break;
            }

            if (myUserId == null) {
              console.warn(
                "⚠️ [QUEUE] 사용자 ID를 확인할 수 없어 대기열 상태를 처리할 수 없습니다."
              );
              break;
            }

            const key = String(myUserId);
            // 키가 문자열로 올 수 있으니 문자열 우선 조회, 보조로 숫자 키도 조회 시도
            const raw =
              (queueStatuses as Record<string, Partial<QueueStatus>>)[key] ??
              (
                queueStatuses as unknown as Record<number, Partial<QueueStatus>>
              )[myUserId as number];

            if (raw) {
              const next: QueueStatus = {
                ahead: Number(raw.ahead ?? 0),
                behind: Number(raw.behind ?? 0),
                total: Number(raw.total ?? 0),
                lastUpdated: Number(raw.lastUpdated ?? 0),
              };

              setMyQueueStatus(next);
              console.log("✅ [QUEUE] 내 대기열 상태 업데이트 성공:", {
                myUserId,
                ...next,
                timestamp: event.timestamp ?? Date.now(),
              });
            } else {
              console.log(
                "ℹ️ [QUEUE] 아직 대기열에 진입하지 않음 (내 userId 미포함)",
                {
                  myUserId,
                  keys: Object.keys(queueStatuses),
                }
              );
            }
          } catch (e) {
            console.error("❌ [QUEUE] 대기열 상태 처리 실패:", e, event);
          }
          break;
        }

        case "USER_JOINED":
        case "USER_ENTERED": {
          const userId = payload?.userId || event.userId;
          // userName (대문자 N)과 username (소문자 n) 모두 지원
          const username =
            payload?.userName ||
            payload?.username ||
            event.userName ||
            event.username;
          const totalUsersInRoom = payload?.totalUsersInRoom;

          if (userId) {
            console.log(
              `✅ 유저 입장: userId=${userId}, username=${username || "알 수 없음"}, 총 인원=${totalUsersInRoom || "알 수 없음"}`
            );
            console.log(`📝 메시지: ${event.message || ""}`);

            setRoomMembers((prev) => {
              // 이미 존재하는지 확인
              const existingIndex = prev.findIndex((m) => m.userId === userId);
              if (existingIndex !== -1) {
                // 이미 존재하는 유저인 경우 이름 업데이트
                if (username) {
                  console.log(
                    `🔄 유저 이름 업데이트: userId=${userId}, 새 이름=${username}`
                  );
                  const updated = [...prev];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    username: username,
                  };
                  return updated;
                } else {
                  console.log("⚠️ 이미 존재하는 유저입니다:", userId);
                  return prev;
                }
              }

              // 새 유저 추가 (username이 없으면 임시로 "사용자{userId}" 사용)
              const newMember: RoomMember = {
                userId,
                username: username || `사용자${userId}`,
                enteredAt: event.timestamp || Date.now(),
              };

              console.log("➕ 새 멤버 추가:", newMember);
              return [...prev, newMember];
            });
          } else if (event.roomMembers && Array.isArray(event.roomMembers)) {
            // roomMembers 배열로 전체 업데이트 (기존 형식)
            console.log("👥 방 멤버 목록 전체 업데이트 (roomMembers 배열)");
            setRoomMembers(event.roomMembers);
          } else {
            console.warn("⚠️ USER_JOINED 이벤트에 userId가 없습니다:", event);
          }
          break;
        }

        case "USER_LEFT":
        case "USER_EXITED": {
          const userId = payload?.userId || event.userId;
          const totalUsersInRoom = payload?.totalUsersInRoom;

          if (userId) {
            console.log(
              `👋 유저 퇴장: userId=${userId}, 남은 인원=${totalUsersInRoom || "알 수 없음"}`
            );
            console.log(`📝 메시지: ${event.message || ""}`);

            setRoomMembers((prev) => {
              const filtered = prev.filter((m) => m.userId !== userId);
              console.log(
                `➖ 멤버 제거: ${userId}, 이전 인원: ${prev.length}, 현재 인원: ${filtered.length}`
              );
              return filtered;
            });
          } else if (event.roomMembers && Array.isArray(event.roomMembers)) {
            // roomMembers 배열로 전체 업데이트 (기존 형식)
            console.log("👥 방 멤버 목록 전체 업데이트 (roomMembers 배열)");
            setRoomMembers(event.roomMembers);
          } else {
            console.warn("⚠️ USER_LEFT 이벤트에 userId가 없습니다:", event);
          }
          break;
        }

        case "ROOM_UPDATE":
        case "MEMBERS_UPDATE":
          if (event.roomMembers && Array.isArray(event.roomMembers)) {
            console.log("🔄 방 멤버 목록 전체 업데이트");
            setRoomMembers(event.roomMembers);
          }
          break;

        default:
          console.log("ℹ️ 알 수 없는 이벤트 타입:", eventType, event);
      }
    },
    []
  );

  // 방 생성/입장 응답 데이터 로그
  useEffect(() => {
    if (joinResponse) {
      console.log(
        "🎮 게임룸 데이터 (방 입장 응답):",
        JSON.stringify(joinResponse, null, 2)
      );
      console.log("📋 방 멤버 목록:", joinResponse.roomMembers);
      console.log("🆔 Room ID:", roomId || joinResponse.roomId);
    } else if (roomData) {
      console.log(
        "🎮 게임룸 데이터 (방 생성 응답):",
        JSON.stringify(roomData, null, 2)
      );
      console.log("📋 요청 데이터:", JSON.stringify(roomRequest, null, 2));
      console.log("🆔 Room ID:", roomId || "없음");
    } else if (roomId) {
      console.log("🆔 Room ID (URL 파라미터):", roomId);
      console.log(
        "⚠️ location state에 roomData나 joinResponse가 없습니다. API로 데이터를 가져와야 할 수 있습니다."
      );
    }
  }, [roomData, roomRequest, joinResponse, roomId]);

  // WebSocket 구독: /topic/rooms/{roomId}
  useEffect(() => {
    const targetRoomId =
      roomId ||
      joinResponse?.roomId?.toString() ||
      roomData?.roomId?.toString();

    if (!targetRoomId) {
      console.warn("⚠️ [구독] Room ID가 없어 구독할 수 없습니다.");
      return;
    }

    if (!wsClient) {
      console.warn(
        "⚠️ [구독] WebSocket 클라이언트가 없습니다. 연결을 기다리는 중..."
      );
      return;
    }

    const destination = `/topic/rooms/${targetRoomId}`;
    let retryCount = 0;
    const maxRetries = 20; // 최대 10초 대기 (500ms * 20)

    // Bridge 채널 준비 (교차 창 전달용)
    const bridgeChannelName = `room-${targetRoomId}-events`;
    try {
      if ("BroadcastChannel" in window) {
        bridgeRef.current?.close();
        bridgeRef.current = new BroadcastChannel(bridgeChannelName);
        console.log("🔗 [bridge] 채널 준비:", bridgeChannelName);
      } else {
        console.warn("⚠️ [bridge] BroadcastChannel 미지원 - 브릿지 비활성");
      }
    } catch (e) {
      console.warn("⚠️ [bridge] 채널 생성 실패:", e);
    }

    console.log("🚀 [구독] 구독 프로세스 시작:", {
      targetRoomId,
      destination,
      wsClientConnected: wsClient.connected,
      wsClientActive: wsClient.active,
    });

    // WebSocket이 연결될 때까지 대기
    const checkConnection = () => {
      if (wsClient.connected) {
        console.log(`📡 [구독] 방 구독 시도: ${destination}`);

        const subscription = subscribe(wsClient, destination, (message) => {
          console.log("📨 [메시지 수신] 방 메시지 수신:", {
            destination: message.headers.destination,
            body: message.body,
            headers: message.headers,
            timestamp: new Date().toISOString(),
          });
          try {
            const data = JSON.parse(message.body);
            console.log(
              "📦 [메시지 수신] 파싱된 메시지 데이터:",
              JSON.stringify(data, null, 2)
            );

            // 백엔드 메시지 형식: { eventType, roomId, timestamp, message, payload }
            if (data.eventType) {
              console.log(
                `🔔 [메시지 수신] 이벤트 타입: ${data.eventType}`,
                data
              );
              // Bridge로 교차 창에 전달
              try {
                bridgeRef.current?.postMessage(data);
                // console.debug("📡 [bridge] 이벤트 전달:", data.eventType);
              } catch (e) {
                console.warn("⚠️ [bridge] 이벤트 전달 실패:", e);
              }
              handleRoomEvent(data);
            }
            // roomMembers 배열이 있으면 무조건 업데이트 (기존 형식 지원)
            else if (data.roomMembers && Array.isArray(data.roomMembers)) {
              console.log(
                "👥 [메시지 수신] 방 멤버 목록 업데이트 (roomMembers 배열):",
                data.roomMembers
              );
              setRoomMembers(data.roomMembers);
            }
            // 기타 형식
            else {
              console.log("ℹ️ [메시지 수신] 알 수 없는 메시지 형식:", data);
            }
          } catch (e) {
            console.error(
              "❌ [메시지 수신] 메시지 파싱 실패:",
              e,
              message.body
            );
          }
        });

        if (subscription) {
          subscriptionRef.current = subscription;
          console.log(`✅ [구독] 방 구독 성공: ${destination}`);
          console.log("📋 [구독] 구독 정보:", {
            id: subscription.id,
            destination: destination,
            subscribed: true,
            timestamp: new Date().toISOString(),
          });

          // 구독 후 현재 구독 목록 확인
          {
            const subs = (
              wsClient as unknown as {
                subscriptions?: Record<string, unknown>;
              }
            ).subscriptions;
            if (subs) {
              console.log("📋 [구독] 현재 활성 구독 목록:", Object.keys(subs));
            }
          }
        } else {
          console.error(
            `❌ [구독] 방 구독 실패: ${destination} - subscription이 null입니다.`
          );
        }
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(
            `⏳ [구독] WebSocket 연결 대기 중... (${retryCount}/${maxRetries})`,
            {
              connected: wsClient.connected,
              active: wsClient.active,
            }
          );
          setTimeout(checkConnection, 500);
        } else {
          console.error(
            `❌ [구독] 방 구독 실패: WebSocket 연결 시간 초과 (${destination})`,
            {
              connected: wsClient.connected,
              active: wsClient.active,
            }
          );
        }
      }
    };

    // 초기 연결 확인
    checkConnection();

    // cleanup: 컴포넌트 언마운트 시 구독 해제
    return () => {
      if (subscriptionRef.current) {
        console.log(`🔌 [구독] 방 구독 해제: ${destination}`, {
          subscriptionId: subscriptionRef.current.id,
          timestamp: new Date().toISOString(),
        });
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (bridgeRef.current) {
        try {
          bridgeRef.current.close();
          console.log("🔌 [bridge] 채널 종료:", bridgeChannelName);
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn("[bridge] close 실패:", err);
          }
        }
        bridgeRef.current = null;
      }
    };
  }, [
    wsClient,
    roomId,
    joinResponse?.roomId,
    roomData?.roomId,
    handleRoomEvent,
  ]);

  // 입장자 목록 상태 관리 (WebSocket 메시지로 실시간 업데이트)
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>(() => {
    // 초기값: joinResponse 또는 방 생성 유저
    if (joinResponse?.roomMembers && joinResponse.roomMembers.length > 0) {
      return joinResponse.roomMembers;
    }
    // 입장 응답이 없으면 방 생성 유저만 표시
    const hostName = roomRequest?.username || currentUserNickname || "방장";
    const hostUserId =
      roomRequest?.userId || useAuthStore.getState().userId || 0;
    return [
      {
        userId: hostUserId,
        username: hostName,
        enteredAt: Date.now(),
      },
    ];
  });

  // joinResponse가 변경되면 roomMembers 초기화
  useEffect(() => {
    if (joinResponse?.roomMembers && joinResponse.roomMembers.length > 0) {
      setRoomMembers(joinResponse.roomMembers);
    }
  }, [joinResponse?.roomMembers]);

  // 방 상세 조회: roomMembers가 없고 roomId가 있으면 API로 가져오기 (fallback)
  useEffect(() => {
    // 총 소요 시간 측정 시작: 방 입장 시점에 없으면 초기화
    try {
      if (!sessionStorage.getItem("reserve.totalStartAtMs")) {
        setTotalStartAtMs();
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("Failed to init totalStartAtMs", err);
      }
    }

    const params = new URLSearchParams(location.search);
    const qsId = params.get("roomId");
    const targetId =
      roomId ||
      (roomData?.roomId && Number(roomData.roomId)) ||
      (qsId && !Number.isNaN(Number(qsId)) ? Number(qsId) : undefined);

    (async () => {
      try {
        if (!targetId) return;
        const data: RoomDetailResponse = await getRoomDetail(Number(targetId));
        // 상세 응답 상태 저장
        setRoomDetail(data);
        // Room store에 방 정보 저장 (방 입장 시 captcha는 false로 초기화)
        useRoomStore.getState().setRoomInfo({
          roomId: data.roomId,
          roomName: data.roomName,
          thumbnailValue: data.thumbnailValue,
          thumbnailType: data.thumbnailType,
          hallId: data.hallId,
          hallName: data.hallName,
          startTime: data.startTime,
          captchaPassed: false, // 방 입장 시 캡챠 false로 초기화
          totalSeat: data.totalSeat ?? null, // 총 좌석 수 저장
        });
        // 입장자 목록 업데이트
        if (Array.isArray(data.roomMembers)) {
          setRoomMembers(data.roomMembers);
        }
      } catch (error) {
        console.error("방 상세 조회 실패:", error);
      }
    })();
  }, [roomId, location.search, roomData?.roomId, joinResponse?.roomMembers]);

  // 방장 userId 결정: 방 생성 유저의 userId 또는 roomDetail의 hostId
  const hostUserId = useMemo(() => {
    return roomRequest?.userId || null;
  }, [roomRequest?.userId]);

  // 입장자 목록 구성: roomMembers를 Participant 형식으로 변환
  const participants: Participant[] = useMemo(() => {
    return roomMembers.map((member) => ({
      name: member.username,
      isHost: hostUserId !== null && member.userId === hostUserId, // 방 생성 유저가 방장
      avatarUrl: `https://i.pravatar.cc/48?img=${(member.userId % 70) + 1}`,
    }));
  }, [roomMembers, hostUserId]);

  // maxUserCount를 총 인원수로 사용 (상세 우선)
  const capacity =
    roomDetail?.maxUserCount ||
    roomRequest?.maxUserCount ||
    roomData?.maxBooking ||
    20;

  // 현재 인원수
  const currentCount = roomMembers.length;

  useEffect(() => {
    const until = localStorage.getItem(BANNER_HIDE_KEY);
    if (until && Date.now() < Number(until)) {
      setShowBanner(false);
    }
  }, []);

  // 게임 시작 시간이 변경되면 카운트다운 재계산
  useEffect(() => {
    const newSecondsLeft = calculateSecondsLeft();
    setSecondsLeft(newSecondsLeft);
  }, [calculateSecondsLeft]);

  // 1초마다 카운트다운 업데이트
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        const newSecondsLeft = calculateSecondsLeft();
        // 계산된 값과 현재 값이 다르면 계산된 값 사용 (시간 동기화)
        if (Math.abs(newSecondsLeft - prev) > 1) {
          return newSecondsLeft;
        }
        // 그 외에는 1초씩 감소
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [calculateSecondsLeft]);

  // 예매하기 버튼이 활성화되는 순간의 타임스탬프 기록
  useEffect(() => {
    if (secondsLeft === 0 && reserveAppearedAt === null) {
      const appearedTs = Date.now();
      setReserveAppearedAt(appearedTs);
      setNonReserveClickCount(0);
      setIsTrackingClicks(true);
      // Log: the moment the reserve button becomes available
      console.log("[ReserveTiming] Button appeared", {
        appearedAt: new Date(appearedTs).toISOString(),
      });
    }
  }, [secondsLeft, reserveAppearedAt]);

  // 초기 마운트 시 이미 버튼이 활성화된 경우 처리
  useEffect(() => {
    const initialSecondsLeft = calculateSecondsLeft();
    if (initialSecondsLeft === 0 && reserveAppearedAt === null) {
      const appearedTs = Date.now();
      setReserveAppearedAt(appearedTs);
      setNonReserveClickCount(0);
      setIsTrackingClicks(true);
      console.log("[ReserveTiming] Button already active on mount", {
        appearedAt: new Date(appearedTs).toISOString(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 초기 마운트 시에만 실행

  useEffect(() => {
    if (!isTrackingClicks) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // 예매하기 버튼 클릭은 허용
      const isReserveButton = Boolean(target.closest("[data-reserve-button]"));
      // 활성화된 날짜 버튼 클릭도 허용
      const isEnabledDateButton = Boolean(
        target.closest("[data-enabled-date='true']")
      );
      // 예매하기 버튼과 활성화된 날짜 버튼 외의 클릭은 실수로 처리
      if (!isReserveButton && !isEnabledDateButton) {
        setNonReserveClickCount((prev) => {
          const next = prev + 1;
          console.log("[ReserveTiming] Non-reserve click", { count: next });
          return next;
        });
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [isTrackingClicks]);

  // 카운트다운 포맷팅 (MM:SS 형식)
  const formatted = useMemo(() => {
    if (secondsLeft <= 0) {
      return "00:00";
    }
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, [secondsLeft]);

  // 방 나가기 핸들러
  const handleExitRoom = useCallback(async () => {
    const targetRoomId =
      roomId ||
      joinResponse?.roomId?.toString() ||
      roomData?.roomId?.toString();

    if (!targetRoomId) {
      alert("방 ID를 찾을 수 없습니다.");
      return;
    }

    if (!currentUserId || !currentUserNickname) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!confirm("정말 방을 나가시겠습니까?")) {
      return;
    }

    setIsExiting(true);
    try {
      console.log("🚪 방 나가기 요청 시작:", {
        roomId: targetRoomId,
        userId: currentUserId,
        userName: currentUserNickname,
      });

      const response = await exitRoom(Number(targetRoomId), {
        userId: currentUserId,
        userName: currentUserNickname,
      });

      console.log("✅ 방 나가기 성공:", JSON.stringify(response, null, 2));
      console.log("📊 남은 인원:", response.leftUserCount);
      console.log("📊 방 상태:", response.roomStatus);

      // Room store 초기화
      useRoomStore.getState().clearRoomInfo();

      // WebSocket 구독 해제
      if (subscriptionRef.current) {
        console.log(`🔌 방 구독 해제: ${response.unsubscriptionTopic}`);
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }

      // 방이 종료되었거나 성공적으로 나간 경우 홈으로 이동
      if (response.roomStatus === "CLOSED" || response.leftUserCount >= 0) {
        navigate(paths.home, { replace: true });
      } else {
        // 예상치 못한 경우에도 홈으로 이동
        navigate(paths.home, { replace: true });
      }
    } catch (error) {
      console.error("❌ 방 나가기 실패:", error);
      if (error instanceof Error) {
        alert(error.message || "방 나가기에 실패했습니다.");
      } else {
        alert("방 나가기에 실패했습니다.");
      }
    } finally {
      setIsExiting(false);
    }
  }, [
    roomId,
    joinResponse?.roomId,
    roomData?.roomId,
    currentUserId,
    currentUserNickname,
    navigate,
  ]);

  // 브라우저 뒤로가기 시에도 '방 나가기'와 동일한 동작 수행
  useEffect(() => {
    const pushState = () => {
      try {
        window.history.pushState(null, "", window.location.href);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("history.pushState 실패:", err);
        }
      }
    };
    // 현재 위치를 한 번 더 쌓아 뒤로가기를 중단시킴
    pushState();
    const onPopState = () => {
      // 즉시 현재 페이지에 머물도록 다시 푸시
      pushState();
      // 동일한 퇴장 로직 호출 (확인창 포함)
      handleExitRoom();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [handleExitRoom]);

  const openQueueWindow = () => {
    let finalUrl: string;
    const baseUrl =
      (paths as { booking: { waiting: string } })?.booking?.waiting ??
      "/booking/waiting";
    const clickedTs = Date.now();
    const totalStartAt = getTotalStartAtMs() ?? clickedTs;

    // matchId 결정: store 우선 → joinResponse.matchId
    // 주의: matchId는 티켓팅 시스템의 ID이고, roomId와는 다른 개념입니다.
    // roomId를 matchId로 사용하지 않습니다.
    const jr = joinResponse as unknown as {
      matchId?: unknown;
    };
    const rawMatchId =
      matchIdFromStore ?? (jr?.matchId != null ? Number(jr.matchId) : null);
    const matchIdParam = rawMatchId != null ? String(rawMatchId) : undefined;

    // hallId 결정: roomDetail → roomData → roomRequest 순으로 확인
    const hallId =
      roomDetail?.hallId ?? roomData?.hallId ?? roomRequest?.hallId;
    const hallIdParam = hallId
      ? `&hallId=${encodeURIComponent(String(hallId))}`
      : "";

    // 일자 정보 결정: roomDetail → roomRequest 순으로 확인
    const startTime = roomDetail?.startTime ?? roomRequest?.gameStartTime;
    const reservationDay = startTime
      ? dayjs(startTime).format("YYYY-MM-DD")
      : roomRequest?.reservationDay;

    const dateParam = reservationDay
      ? `&date=${encodeURIComponent(reservationDay)}`
      : "";
    // 회차는 단일 회차(1회차)로 고정
    const roundParam = `&round=1`;

    if (reserveAppearedAt) {
      const reactionMs = clickedTs - reserveAppearedAt;
      // 밀리초 단위로 계산 후 초 단위로 변환 (소수점 2자리까지)
      const reactionSec = Number((reactionMs / 1000).toFixed(2));
      // Log: reaction time between appearance and click
      console.log("[ReserveTiming] Reaction time until click", {
        reactionMs,
        reactionSec,
        appearedAt: new Date(reserveAppearedAt).toISOString(),
        clickedAt: new Date(clickedTs).toISOString(),
        nonReserveClickCount,
      });
      setIsTrackingClicks(false);
      finalUrl = `${baseUrl}?rtSec=${encodeURIComponent(String(reactionSec))}&nrClicks=${encodeURIComponent(String(nonReserveClickCount))}&tStart=${encodeURIComponent(String(totalStartAt))}${
        matchIdParam ? `&matchId=${encodeURIComponent(matchIdParam)}` : ""
      }${hallIdParam}${dateParam}${roundParam}`;
    } else {
      console.log(
        "[ReserveTiming] Click without appearance timestamp (possibly test click)"
      );
      finalUrl = `${baseUrl}?rtSec=0&nrClicks=${encodeURIComponent(String(nonReserveClickCount))}&tStart=${encodeURIComponent(String(totalStartAt))}${
        matchIdParam ? `&matchId=${encodeURIComponent(matchIdParam)}` : ""
      }${hallIdParam}${dateParam}${roundParam}`;
    }

    window.open(
      finalUrl,
      "_blank",
      "width=900,height=682,toolbar=no,menubar=no,location=no,status=no,scrollbars=yes,resizable=no"
    );
  };

  return (
    <>
      <div className="min-h-screen overflow-x-auto">
        {showBanner && (
          <TopBanner
            onClose={(hideFor3Days) => {
              if (hideFor3Days) {
                const until = Date.now() + 3 * 24 * 60 * 60 * 1000;
                localStorage.setItem(BANNER_HIDE_KEY, String(until));
              }
              setShowBanner(false);
            }}
          />
        )}

        <div className="productWrapper max-w-[1280px] w-full mx-auto px-4 md:px-6">
          <TagsRow
            difficulty={roomDetail?.difficulty}
            botCount={roomDetail?.botCount}
            totalSeat={
              roomDetail?.totalSeat ||
              roomData?.totalSeat ||
              (joinResponse as { totalSeat?: number })?.totalSeat ||
              roomRequest?.totalSeat
            }
          />
          <TitleSection
            matchName={roomDetail?.roomName}
            hallSize={roomDetail?.hallSize}
            venue={roomDetail?.hallName}
            onOpenSettings={() => setIsRoomModalOpen(true)}
            onOpenStopwatch={() => setShowStopwatch(true)}
            onExitRoom={handleExitRoom}
            isExiting={isExiting}
          />

          <div className="mt-6 flex flex-col md:flex-row gap-8">
            <div className="summary w-full md:w-[830px]">
              <div className="flex flex-col md:flex-row items-start">
                <PosterBox
                  thumbnailType={
                    roomDetail?.thumbnailType || roomData?.thumbnailType
                  }
                  thumbnailValue={
                    roomDetail?.thumbnailValue || roomData?.thumbnailValue
                  }
                />
                <div className="ml-0 md:ml-[25px] my-0 mr-0 w-full md:w-[400px]">
                  <ParticipantList
                    participants={participants}
                    capacity={capacity}
                    currentCount={currentCount}
                  />
                </div>
              </div>
            </div>
            <aside className="productSide w-full md:w-[370px] mt-6 md:mt-0">
              <StartInfoCard
                reservationDay={
                  roomDetail?.startTime
                    ? dayjs(roomDetail.startTime).format("YYYY-MM-DD")
                    : undefined
                }
                gameStartTime={roomDetail?.startTime}
                remaining={formatted}
                canReserve={secondsLeft === 0}
                onReserve={openQueueWindow}
              />
            </aside>
          </div>
        </div>
      </div>
      <RoomSettingModal
        open={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
      />
      {showStopwatch && <StopwatchHUD draggable />}
    </>
  );
}

function TopBanner({ onClose }: { onClose: (hideFor3Days: boolean) => void }) {
  const [dontShow, setDontShow] = useState(false);
  return (
    <div className="bg-gradient-to-r from-[#104BB7] to-[#072151] text-white">
      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-3 text-sm">
        <p className="absolute inset-0 flex items-center justify-center font-semibold text-center pointer-events-none">
          본 경기는 티켓팅 연습용으로, 실제 티켓팅이 되지 않습니다.
        </p>
        <div className="flex items-center gap-4 justify-end">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
            />
            <span>3일간 보지않기</span>
          </label>
          <button
            aria-label="close-banner"
            onClick={() => onClose(dontShow)}
            className="text-xl leading-none"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function TagsRow({
  difficulty,
  botCount,
  totalSeat,
}: {
  difficulty?: string;
  botCount?: number;
  totalSeat?: number;
}) {
  const Pill = ({
    children,
    bgVar,
    colorVar,
  }: {
    children: string;
    bgVar: string;
    colorVar: string;
  }) => (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
      style={{ backgroundColor: `var(${bgVar})`, color: `var(${colorVar})` }}
    >
      {children}
    </span>
  );

  const difficultyLabel = difficulty
    ? DIFFICULTY_TO_LABEL[difficulty] || difficulty
    : "어려움";
  // totalSeat가 있으면 "총 좌석 수 --명"으로 표시, 없으면 최대 천 명
  const maxLabel = totalSeat
    ? `총 좌석수 ${totalSeat.toLocaleString()}명`
    : `총 좌석수 1,000명`;
  const botLabel = botCount ? `봇 ${botCount.toLocaleString()}명` : "봇 3000명";

  return (
    <div className="flex items-center gap-3 py-4">
      <Pill bgVar="--color-c-red-100" colorVar="--color-c-red-200">
        {difficultyLabel}
      </Pill>
      <Pill bgVar="--color-c-blue-100" colorVar="--color-c-blue-200">
        {maxLabel}
      </Pill>
      <Pill bgVar="--color-c-blue-100" colorVar="--color-c-blue-200">
        {botLabel}
      </Pill>
    </div>
  );
}

function TitleSection({
  matchName,
  hallSize,
  venue,
  onOpenStopwatch,
  onExitRoom,
  isExiting,
}: {
  matchName?: string;
  hallSize?: string;
  venue?: string;
  onOpenSettings: () => void;
  onOpenStopwatch: () => void;
  onExitRoom: () => void;
  isExiting?: boolean;
}) {
  const title = matchName || "18시에 티켓팅하실 분 모집합니다";
  const sizeLabel = hallSize
    ? HALL_SIZE_TO_LABEL[hallSize] || hallSize
    : "소형";
  const venueLabel = venue ? convertHallNameToKorean(venue) : "샤롯데씨어터";

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
          {title}
        </h1>
        <button
          type="button"
          onClick={onExitRoom}
          disabled={isExiting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ExitToAppIcon fontSize="small" />
          <span>{isExiting ? "나가는 중..." : "방 나가기"}</span>
        </button>
      </div>
      <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
        <span>{sizeLabel}</span>
        <span className="text-gray-300">|</span>
        <span>{venueLabel}</span>
        {/* <span className="text-gray-300">|</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-gray-500 cursor-pointer hover:text-gray-700"
          onClick={onOpenSettings}
        >
          <SettingsOutlinedIcon fontSize="small" />
          <span>방 설정</span>
        </button> */}
        <span className="text-gray-300">|</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-gray-500 cursor-pointer hover:text-gray-700"
          onClick={onOpenStopwatch}
        >
          <AccessTimeOutlinedIcon fontSize="small" />
          <span>타이머 설정</span>
        </button>
      </div>
    </div>
  );
}

function PosterBox({
  thumbnailType,
  thumbnailValue,
}: {
  thumbnailType?: string;
  thumbnailValue?: string | null;
}) {
  let thumbnailSrc = Thumbnail03; // 기본값

  if (thumbnailType === "PRESET" && thumbnailValue) {
    // 썸네일 번호로 이미지 선택
    thumbnailSrc = THUMBNAIL_IMAGES[thumbnailValue] || Thumbnail03;
  } else if (thumbnailType === "UPLOADED" && thumbnailValue) {
    // 업로드된 이미지 URL 사용
    thumbnailSrc = thumbnailValue;
  }

  return (
    <div>
      <img
        src={thumbnailSrc}
        alt="포스터 이미지"
        className="posterBoxImage w-40 h-56 md:w-[300px] md:h-[400px] object-cover rounded-lg border border-neutral-200"
      />
    </div>
  );
}

// removed SeatThumbnail and Legend in favor of PosterBox

function ParticipantList({
  participants,
  capacity,
  currentCount,
}: {
  participants: Participant[];
  capacity: number;
  currentCount?: number;
}) {
  return (
    <section className="bg-white rounded-xl overflow-hidden border border-neutral-200 shadow">
      <div className="flex items-center justify-between px-4 py-3 bg-[#eef2ff]">
        <div className="flex items-center gap-2 font-semibold text-gray-700">
          <PeopleIcon style={{ color: "var(--color-c-blue-200)" }} />
          <span>입장자</span>
        </div>
        <span className="text-sm text-gray-700 font-bold">
          {currentCount ?? participants.length} / {capacity}명
        </span>
      </div>
      <ul className="h-[420px] overflow-y-auto py-1 space-y-1 pr-1 nice-scroll">
        {participants.map((p, idx) => (
          <li key={idx} className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt={p.name}
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 text-indigo-700">
                  👤
                </span>
              )}
              <span className="text-gray-800">{p.name}</span>
            </div>
            {p.isHost && (
              <span className="text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-semibold">
                방장
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StartInfoCard({
  reservationDay,
  gameStartTime,
  remaining,
  canReserve,
  onReserve,
}: {
  reservationDay?: string;
  gameStartTime?: string;
  remaining: string;
  canReserve: boolean;
  onReserve: () => void;
}) {
  // 날짜 포맷팅 (yyyy-MM-dd -> yyyy.MM.dd)
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "2025.10.23";
    const [year, month, day] = dateStr.split("-");
    return `${year}.${month}.${day}`;
  };

  // 시간 포맷팅 (ISO string -> HH:mm)
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return "18:00";
    const date = dayjs(timeStr);
    return date.format("HH:mm");
  };

  const formattedDate = formatDate(reservationDay);
  const formattedTime = formatTime(gameStartTime);
  const openAt = `${formattedDate} ${formattedTime}`;

  if (canReserve) {
    return (
      <BookingCalendarCard
        onBook={onReserve}
        reservationDay={reservationDay}
        gameStartTime={gameStartTime}
      />
    );
  }
  return (
    <section className="bg-white rounded-xl p-6 flex flex-col items-stretch border border-neutral-200 shadow">
      <h3 className="text-lg font-bold text-gray-900 mb-4">경기시작안내</h3>
      <div className="rounded-xl border bg-[#fafafa] p-6 text-center mb-6">
        <div className="text-2xl font-extrabold text-red-500 mb-2">Start</div>
        <div className="text-gray-800 font-semibold">티켓오픈</div>
        <div className="text-gray-600 mt-1">{openAt}</div>
        <p className="text-xs text-gray-500 mt-3">
          경기가 위 시간에 시작될 예정이므로 준비해주세요.
        </p>
      </div>
      <button
        className="mt-auto w-full py-4 rounded-lg bg-gray-200 text-gray-700 font-extrabold"
        disabled
        type="button"
      >
        남은시간 {remaining}
      </button>
    </section>
  );
}

// gameStartTime을 기반으로 시간 슬롯 포맷팅
const formatTimeSlot = (timeStr?: string) => {
  if (!timeStr) return "1회 14:30";
  const date = dayjs(timeStr);
  const hour = date.hour();
  const minute = date.minute();
  return `1회 ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};

function BookingCalendarCard({
  onBook,
  reservationDay,
  gameStartTime,
}: {
  onBook: () => void;
  reservationDay?: string;
  gameStartTime?: string;
}) {
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  // reservationDay를 기반으로 초기 날짜 설정
  const initialDate = reservationDay ? dayjs(reservationDay).toDate() : today;

  const [month, setMonth] = useState<number>(initialDate.getMonth());
  const [year, setYear] = useState<number>(initialDate.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate);
  const [selectedSlot, setSelectedSlot] = useState<string>(
    formatTimeSlot(gameStartTime)
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(true);
  const [isTimesOpen, setIsTimesOpen] = useState<boolean>(true);

  const monthStart = new Date(year, month, 1);
  const startDay = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: Array<Array<number | null>> = [];
  let day = 1 - startDay; // Sunday-first grid
  for (let w = 0; w < 6; w++) {
    const week: Array<number | null> = [];
    for (let d = 0; d < 7; d++) {
      const dateNum = day;
      if (dateNum < 1 || dateNum > daysInMonth) week.push(null);
      else week.push(dateNum);
      day++;
    }
    weeks.push(week);
  }

  const monthLabel = `${year}. ${(month + 1).toString().padStart(2, "0")}`;

  const isSelected = (d: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === d
    );
  };

  const changeMonth = (delta: number) => {
    const base = new Date(year, month + delta, 1);
    setYear(base.getFullYear());
    setMonth(base.getMonth());
  };

  const dateMeta = (d: number) => {
    const dateObj = new Date(year, month, d);
    const isSunday = dateObj.getDay() === 0;
    // 오늘부터 2일 후까지만 활성화 (총 3일)
    const maxDate = new Date(todayStart);
    maxDate.setDate(todayStart.getDate() + 2);
    const isDisabled = dateObj < todayStart || dateObj > maxDate;
    const selected = isSelected(d);
    return { dateObj, isSunday, isDisabled, selected };
  };

  const formatSelectedDate = (date: Date) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    const weekday = "일월화수목금토"[date.getDay()];
    return `${y}.${m}.${d} (${weekday})`;
  };

  return (
    <section className="bg-white rounded-xl p-4 border border-neutral-200 shadow flex flex-col">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-base font-bold text-gray-900"
          onClick={() => setIsCalendarOpen((v) => !v)}
          aria-label="toggle-calendar"
        >
          관람일
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-7 w-7 grid place-items-center rounded-full text-gray-600 "
            onClick={() => changeMonth(-1)}
            aria-label="prev-month"
          >
            ‹
          </button>
          <div className="min-w-[120px] text-center font-semibold">
            {monthLabel}
          </div>
          <button
            type="button"
            className="h-7 w-7 grid place-items-center rounded-full text-gray-600 "
            onClick={() => changeMonth(1)}
            aria-label="next-month"
          >
            ›
          </button>
          <IconButton
            size="small"
            onClick={() => {
              setIsCalendarOpen((v) => !v);
              setIsTimesOpen(true);
            }}
            aria-label="collapse-calendar"
            className={`transition-transform ${isCalendarOpen ? "rotate-180" : ""}`}
            sx={{ color: "#6b7280", p: 0.5 }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white p-3">
        {/* Condensed date when collapsed */}
        {!isCalendarOpen && selectedDate && (
          <div className="text-lg font-semibold text-gray-900">
            {formatSelectedDate(selectedDate)}
          </div>
        )}

        <Collapse in={isCalendarOpen} timeout="auto">
          <div>
            {/* Weekday bar */}
            <div className="grid grid-cols-7 text-center text-xs text-gray-600 bg-gray-50 rounded-xl py-1">
              {"일월화수목금토".split("").map((ch) => (
                <div key={ch} className="py-1 font-medium">
                  {ch}
                </div>
              ))}
            </div>

            {/* Dates grid */}
            <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
              {weeks.map((wk, wi) => (
                <div key={wi} className="contents">
                  {wk.map((d, di) => {
                    if (!d) return <div key={di} className="py-2" />;
                    const { isSunday, isDisabled, selected } = dateMeta(d);
                    const baseColor = isDisabled
                      ? isSunday
                        ? "text-red-300"
                        : "text-gray-300"
                      : isSunday
                        ? "text-red-500"
                        : "text-gray-900";
                    return (
                      <button
                        key={di}
                        type="button"
                        disabled={isDisabled}
                        onClick={() =>
                          !isDisabled &&
                          setSelectedDate(new Date(year, month, d))
                        }
                        className={`mx-auto h-10 w-10 rounded-full text-sm transition-colors ${
                          selected
                            ? "bg-indigo-600 text-white"
                            : `${baseColor} ${isDisabled ? "" : "hover:bg-gray-100"}`
                        } ${isDisabled ? "cursor-not-allowed pointer-events-none" : ""}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Collapse>

        {/* Divider */}
        <div className="my-3 h-px bg-gray-100" />

        {/* Times header with toggle */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">회차</h4>
          <IconButton
            size="small"
            onClick={() => setIsTimesOpen((v) => !v)}
            aria-label="toggle-times"
            className={`transition-transform ${isTimesOpen ? "rotate-180" : ""}`}
            sx={{ color: "#6b7280", p: 0.5 }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </div>

        <Collapse in={isTimesOpen} timeout="auto">
          <div className="mt-2">
            <div className="grid grid-cols-2 gap-2">
              {[{ label: formatTimeSlot(gameStartTime) }].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSelectedSlot(s.label)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    selectedSlot === s.label
                      ? "border-indigo-500 text-indigo-700"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-700">
              R석 100 / S석 150 / A석 200 / B석 300
            </div>
          </div>
        </Collapse>
      </div>

      {/* Actions inside same container, without outer border */}
      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          data-reserve-button
          onClick={onBook}
          className="w-full py-4 rounded-xl bg-indigo-600 text-white font-extrabold hover:bg-indigo-700"
        >
          예매하기
        </button>
        <button
          type="button"
          className="w-full py-3 rounded-xl border text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-sm font-semibold"
        >
          BOOKING / 外國語
        </button>
      </div>
    </section>
  );
}
