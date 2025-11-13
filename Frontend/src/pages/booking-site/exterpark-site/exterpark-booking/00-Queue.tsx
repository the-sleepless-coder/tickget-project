import { useEffect, useRef, useState, useCallback } from "react";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paths } from "../../../../app/routes/paths";
import Viewport from "./_components/Viewport";
import BookingLoadingPage from "./00-Loading";
import {
  requestCaptchaImage,
  enqueueTicketingQueue,
} from "@features/booking-site/api";
import { useMatchStore } from "@features/booking-site/store";
import { useRoomStore } from "@features/room/store";
import { useAuthStore } from "@features/auth/store";
import { useWebSocketStore } from "../../../../shared/lib/websocket-store";
import { subscribe, type Subscription } from "../../../../shared/lib/websocket";

export default function BookingWaitingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stage, setStage] = useState<"loading" | "queue" | "captcha">(
    "loading"
  );
  const matchIdFromStore = useMatchStore((s) => s.matchId);
  const [rank, setRank] = useState<number>(0);
  const [totalQueue, setTotalQueue] = useState<number>(0);
  const hasDequeuedRef = useRef<boolean>(false);
  const wsClient = useWebSocketStore((s) => s.client);
  const roomId = useRoomStore((s) => s.roomInfo.roomId);
  const subscriptionRef = useRef<Subscription | null>(null);
  const enqueuedRef = useRef<boolean>(false);
  // 실데이터 수신 기반으로만 표시 (시뮬레이션 제거)

  // booking-site API 연결: 캡차 이미지 사전 확인
  useEffect(() => {
    (async () => {
      try {
        const captcha = await requestCaptchaImage();
        console.log("[booking-site][captcha.request] 성공:", captcha);
      } catch (error) {
        console.error("[booking-site][captcha.request] 실패:", error);
      }
    })();
  }, []);

  // 시뮬레이션 제거: 실제 수신 이벤트만 반영

  // 공통 이벤트 처리 함수 (WebSocket과 BroadcastChannel 모두에서 사용)
  const handleQueueEvent = useCallback((
    data: {
      eventType?: string;
      type?: string;
      payload?: {
        queueStatuses?: Record<string, { ahead?: number; behind?: number; total?: number; lastUpdated?: number }>;
        userId?: number;
        matchId?: string | number;
        timestamp?: number;
      };
      timestamp?: number;
    },
    source: "ws" | "bridge"
  ) => {
    const evtType = data?.eventType || data?.type;
    console.log(`📨 [waiting][${source}] 메시지 수신:`, {
      eventType: evtType,
      timestamp: new Date().toISOString(),
    });

    if (evtType === "QUEUE_STATUS_UPDATE") {
      const myUserId = useAuthStore.getState().userId;
      const statuses = data.payload?.queueStatuses;
      if (!statuses) {
        console.warn(`[waiting][QUEUE][${source}] payload.queueStatuses 없음:`, data);
        return;
      }
      if (myUserId == null) {
        console.warn(`[waiting][QUEUE][${source}] 사용자 ID 없음, 처리 불가`);
        return;
      }
      const key = String(myUserId);
      const raw =
        statuses[key] ??
        (statuses as unknown as Record<number, { ahead?: number; behind?: number; total?: number; lastUpdated?: number }>)[
          myUserId as number
        ];
      if (raw) {
        const ahead = Number(raw.ahead ?? 0);
        const behind = Number(raw.behind ?? 0);
        const currentRank = ahead + 1;
        const currentTotalQueue = ahead + 1 + behind;
        setRank(currentRank);
        setTotalQueue(currentTotalQueue);
        console.log(`✅ [waiting][QUEUE][${source}] 대기열 갱신 성공:`, {
          myUserId,
          ahead,
          behind,
          currentRank,
          currentTotalQueue,
          now: Date.now(),
        });

        // 항상 큐 화면 유지: DEQUEUE 이벤트 전까지는 대기열 표시
        setStage("queue");
      } else {
        console.log(
          `ℹ️ [waiting][QUEUE][${source}] 아직 대기열 미진입(내 userId 미포함):`,
          {
            myUserId,
            keys: Object.keys(statuses),
          }
        );
      }
    } else if (evtType === "USER_DEQUEUED") {
      const myUserId = useAuthStore.getState().userId;
      const p = (data.payload ?? {}) as {
        userId?: number;
        matchId?: string | number;
        timestamp?: number;
      };

      if (myUserId == null) {
        console.warn(`[waiting][DEQUEUE][${source}] 사용자 ID 없음, 처리 불가`);
        return;
      }
      if (p.userId == null) {
        console.warn(`[waiting][DEQUEUE][${source}] payload.userId 없음:`, data);
        return;
      }
      if (hasDequeuedRef.current) {
        return; // 중복 처리 방지
      }

      if (Number(p.userId) === Number(myUserId)) {
        hasDequeuedRef.current = true;
        // matchId 저장
        const numericMatchId =
          typeof p.matchId === "string" ? Number(p.matchId) : p.matchId;
        if (numericMatchId != null && !Number.isNaN(numericMatchId)) {
          useMatchStore.getState().setMatchId(numericMatchId as number);
        }
        console.log(`✅ [waiting][DEQUEUE][${source}] 본인 티켓팅 성공!`, {
          myUserId,
          matchId: p.matchId,
          ts: p.timestamp ?? data.timestamp ?? Date.now(),
        });

        // 즉시 좌석 선택 화면으로 이동
        const rtSec = searchParams.get("rtSec") ?? "0";
        const nrClicks = searchParams.get("nrClicks") ?? "0";
        const hallId = searchParams.get("hallId");
        const date = searchParams.get("date");
        const round = searchParams.get("round");
        const nextUrl = new URL(
          window.location.origin + paths.booking.selectSeat
        );
        nextUrl.searchParams.set("rtSec", rtSec);
        nextUrl.searchParams.set("nrClicks", nrClicks);
        const tStart = searchParams.get("tStart");
        if (tStart) nextUrl.searchParams.set("tStart", tStart);
        if (hallId) nextUrl.searchParams.set("hallId", hallId);
        if (p.matchId != null)
          nextUrl.searchParams.set("matchId", String(p.matchId));
        else {
          const fallbackMatch =
            matchIdFromStore != null
              ? String(matchIdFromStore)
              : searchParams.get("matchId");
          if (fallbackMatch)
            nextUrl.searchParams.set("matchId", fallbackMatch);
        }
        if (date) nextUrl.searchParams.set("date", date);
        if (round) nextUrl.searchParams.set("round", round);
        navigate(nextUrl.pathname + nextUrl.search, { replace: true });
      } else {
        console.log(`ℹ️ [waiting][DEQUEUE][${source}] 다른 유저 티켓팅 성공:`, {
          dequeuedUserId: p.userId,
          myUserId,
        });
      }
    } else {
      console.log(`ℹ️ [waiting][${source}] QUEUE 외 이벤트:`, evtType);
    }
  }, [navigate, searchParams, matchIdFromStore]);

  // Bridge 수신: 원래 창에서 전달한 WebSocket 이벤트를 수신
  useEffect(() => {
    if (!roomId) return;
    if (!("BroadcastChannel" in window)) {
      console.warn("[waiting][bridge] BroadcastChannel 미지원");
      return;
    }

    const channelName = `room-${roomId}-events`;
    const bc = new BroadcastChannel(channelName);
    console.log("🔗 [waiting][bridge] 채널 연결:", channelName);

    bc.onmessage = (ev: MessageEvent) => {
      try {
        const data = ev.data as {
          eventType?: string;
          type?: string;
          payload?: {
            queueStatuses?: Record<string, { ahead?: number; behind?: number; total?: number; lastUpdated?: number }>;
            userId?: number;
            matchId?: string | number;
            timestamp?: number;
          };
          timestamp?: number;
        };
        // QUEUE_STATUS_UPDATE와 USER_DEQUEUED만 처리
        const evtType = data?.eventType || data?.type;
        if (evtType === "USER_DEQUEUED") {
          console.log("🎯 [waiting][bridge] USER_DEQUEUED 수신!", {
            eventType: evtType,
            userId: (data.payload as { userId?: number })?.userId,
            matchId: (data.payload as { matchId?: string | number })?.matchId,
            timestamp: new Date().toISOString(),
          });
          handleQueueEvent(data, "bridge");
        } else if (evtType === "QUEUE_STATUS_UPDATE") {
          handleQueueEvent(data, "bridge");
        } else {
          console.log(`ℹ️ [waiting][bridge] 기타 이벤트 수신: ${evtType}`);
        }
      } catch (e) {
        console.error("❌ [waiting][bridge] 메시지 처리 실패:", e);
      }
    };

    return () => {
      try {
        bc.close();
        console.log("🔌 [waiting][bridge] 채널 종료:", channelName);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("[waiting][bridge] close 실패:", err);
        }
      }
    };
  }, [roomId, handleQueueEvent]);

  // WebSocket 구독: /topic/rooms/{roomId} 에서 QUEUE_STATUS_UPDATE 수신
  useEffect(() => {
    if (!roomId) {
      console.warn("[waiting][ws] roomId가 없어 구독을 건너뜁니다.");
      return;
    }
    if (!wsClient) {
      console.warn(
        "[waiting][ws] WebSocket 클라이언트가 없어 구독을 건너뜁니다."
      );
      return;
    }

    const destination = `/topic/rooms/${roomId}`;
    let retries = 0;
    const maxRetries = 20;

    type QueueEntry = {
      ahead?: number;
      behind?: number;
      total?: number;
      lastUpdated?: number;
    };
    type QueuePayload = { queueStatuses?: Record<string, QueueEntry> };

    const handleMessage = (msg: {
      body: string;
      headers: Record<string, string>;
    }) => {
      try {
        const data = JSON.parse(msg.body) as {
          eventType?: string;
          payload?: QueuePayload;
          timestamp?: number;
          type?: string;
        };
        // QUEUE_STATUS_UPDATE와 USER_DEQUEUED만 처리 (공통 함수 사용)
        const evtType = data?.eventType || data?.type;
        if (evtType === "USER_DEQUEUED") {
          console.log("🎯 [waiting][ws] USER_DEQUEUED 수신!", {
            eventType: evtType,
            userId: (data.payload as { userId?: number })?.userId,
            matchId: (data.payload as { matchId?: string | number })?.matchId,
            timestamp: new Date().toISOString(),
          });
          handleQueueEvent(data, "ws");
        } else if (evtType === "QUEUE_STATUS_UPDATE") {
          handleQueueEvent(data, "ws");
        } else {
          console.log(`ℹ️ [waiting][ws] 기타 이벤트 수신: ${evtType}`);
        }
      } catch (e) {
        console.error("❌ [waiting][ws] 메시지 파싱 실패:", e);
      }
    };

    const trySubscribe = () => {
      if (wsClient.connected) {
        const sub = subscribe(wsClient, destination, (message) => {
          handleMessage(
            message as unknown as {
              body: string;
              headers: Record<string, string>;
            }
          );
        });
        if (sub) {
          subscriptionRef.current = sub;
          console.log(`✅ [waiting][ws] 구독 성공: ${destination}`);
        } else {
          console.error(
            `❌ [waiting][ws] 구독 실패: ${destination} (subscription=null)`
          );
        }
        return;
      }
      retries += 1;
      if (retries <= maxRetries) {
        console.log(`[waiting][ws] 연결 대기 중... (${retries}/${maxRetries})`);
        setTimeout(trySubscribe, 500);
      } else {
        console.error(`[waiting][ws] 연결 실패: 시간 초과 (${destination})`);
      }
    };

    trySubscribe();

    return () => {
      if (subscriptionRef?.current) {
        console.log(`🔌 [waiting][ws] 구독 해제: ${destination}`);
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [roomId, wsClient, handleQueueEvent]);

  // 대기열 진입 시 큐 등록 API 호출 (matchId가 있을 때만)
  useEffect(() => {
    // matchId 결정: store 우선, 없으면 URL 파라미터에서 가져오기
    const matchId =
      matchIdFromStore != null
        ? String(matchIdFromStore)
        : (searchParams.get("matchId") ?? null);
    console.log("[booking-site][queue.enqueue] matchId 확인:", {
      fromQuery: searchParams.get("matchId"),
      fromStore: matchIdFromStore,
      used: matchId,
    });
    const clickMiss = Number(searchParams.get("nrClicks")) || 0;
    const duration = Number(searchParams.get("rtSec")) || 0;
    if (!matchId) {
      console.log("[booking-site][queue.enqueue] matchId가 없어 생략합니다.", {
        clickMiss,
        duration,
      });
      return;
    }
    (async () => {
      try {
        if (enqueuedRef.current) {
          return;
        }
        enqueuedRef.current = true;
        console.log("[booking-site][queue.enqueue] 요청 시작:", {
          matchId,
          clickMiss,
          duration,
        });
        const res = await enqueueTicketingQueue(matchId, {
          clickMiss,
          duration,
        });
        console.log("[booking-site][queue.enqueue] 성공:", res);
      } catch (error) {
        console.error("[booking-site][queue.enqueue] 실패:", error);
      }
    })();
  }, [stage, searchParams, matchIdFromStore]);

  // 캡차는 좌석 선택 페이지의 모달로 이동

  if (stage === "loading") {
    return <BookingLoadingPage />;
  }

  // queue stage
  if (stage === "queue") {
    // 실데이터 기반 진행도(대략): rank/totalQueue 비율을 사용
    const percent =
      totalQueue > 0
        ? Math.max(0, Math.min(100, Math.round((rank / totalQueue) * 100)))
        : 100;
    const widthPercent = Math.max(0, Math.min(100, 100 - percent)); // 좌→우로 증가
    const isImminent = percent <= 20; // 20% 이하이면 임박

    return (
      <Viewport>
        <div className="w-full h-full bg-white">
          <div className="pt-6 max-w-lg mx-auto p-6">
            <h1 className="text-2xl font-extrabold text-gray-900">
              {isImminent
                ? "곧 고객님의 순서가 다가옵니다."
                : "접속 인원이 많아 대기 중입니다."}
            </h1>
            <div
              className={`text-2xl mt-1 font-extrabold ${isImminent ? "text-red-600" : "text-blue-600"}`}
            >
              {isImminent ? "예매를 준비해주세요." : "조금만 기다려주세요."}
            </div>

            <div className="mt-2 text-gray-700">티켓을 겟하다, Tickget!</div>

            <div className="mt-4 rounded-xl border-[#e3e3e3] border shadow-lg bg-white p-6">
              <div className="text-center text-md text-black font-bold mb-2">
                나의 대기순서
              </div>
              <div className="text-center text-6xl font-extrabold text-gray-900">
                {rank}
              </div>

              <div className="mt-2">
                <div className="relative h-6 rounded-full bg-gray-100">
                  <div
                    className={`absolute left-0 top-0 h-6 rounded-full ${
                      isImminent ? "bg-red-500" : "bg-blue-600"
                    }`}
                    style={{ width: `${widthPercent}%` }}
                  />
                  <ConfirmationNumberOutlinedIcon
                    fontSize="small"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 rotate-[-10deg]"
                  />
                </div>
                <div className="mt-4 h-px bg-gray-100" />
                <div className="mt-3 font-regular text-md text-gray-600 flex items-center justify-between">
                  <span>현재 대기인원</span>
                  <span className="text-black font-extrabold">
                    {totalQueue}명
                  </span>
                </div>
              </div>
            </div>
            <ul className="mt-6 text-sm text-gray-400 list-disc pl-5 space-y-1">
              <li>잠시만 기다려주시면, 예매하기 페이지로 연결됩니다.</li>
              <li>
                새로고침하거나 재접속 하시면 대기순서가 초기화되어 대기시간이 더
                길어집니다.
              </li>
            </ul>
          </div>
        </div>
      </Viewport>
    );
  }

  // no further stages; navigation happens after queue
  return null;
}
