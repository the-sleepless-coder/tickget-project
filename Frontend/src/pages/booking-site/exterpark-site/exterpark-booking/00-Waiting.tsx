import { useEffect, useRef, useState } from "react";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paths } from "../../../../app/routes/paths";
import Viewport from "./_components/Viewport";
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
  const [hasDequeued, setHasDequeued] = useState<boolean>(false);
  const [autoNavigated, setAutoNavigated] = useState<boolean>(false);
  const wsClient = useWebSocketStore((s) => s.client);
  const roomId = useRoomStore((s) => s.roomInfo.roomId);
  const subscriptionRef = useRef<Subscription | null>(null);
  // 실데이터 수신 기반으로만 표시 (시뮬레이션 제거)

  useEffect(() => {
    const timer = setTimeout(() => setStage("queue"), 1200);
    return () => clearTimeout(timer);
  }, []);

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

  // WebSocket 구독: /topic/rooms/{roomId} 에서 QUEUE_STATUS_UPDATE 수신
  useEffect(() => {
    if (stage !== "queue") return;
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
        const evtType = data?.eventType || data?.type;
        console.log("📨 [waiting][ws] 메시지 수신:", {
          destination,
          eventType: evtType,
          timestamp: new Date().toISOString(),
        });
        if (evtType === "QUEUE_STATUS_UPDATE") {
          const myUserId = useAuthStore.getState().userId;
          const statuses = data.payload?.queueStatuses;
          if (!statuses) {
            console.warn("[waiting][QUEUE] payload.queueStatuses 없음:", data);
            return;
          }
          if (myUserId == null) {
            console.warn("[waiting][QUEUE] 사용자 ID 없음, 처리 불가");
            return;
          }
          const key = String(myUserId);
          const raw =
            statuses[key] ??
            // 숫자 키로도 시도 (서버 직렬화 차이 대비)
            (statuses as unknown as Record<number, QueueEntry>)[
              myUserId as number
            ];
          if (raw) {
            const total = Number(raw.total ?? 0);
            const behind = Number(raw.behind ?? 0);
            setRank(total); // 나의 대기순서
            setTotalQueue(total + behind); // 현재 대기인원
            console.log("✅ [waiting][QUEUE] 대기열 갱신 성공:", {
              myUserId,
              total,
              behind,
              now: Date.now(),
              wsDestination: destination,
            });

          // 임시 정책: total === 1 이면 좌석 선택 페이지로 이동
          if (total === 1 && !hasDequeued && !autoNavigated) {
            setAutoNavigated(true);
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
            if (hallId) nextUrl.searchParams.set("hallId", hallId);
            const fallbackMatch =
              matchIdFromStore != null
                ? String(matchIdFromStore)
                : searchParams.get("matchId");
            if (fallbackMatch) nextUrl.searchParams.set("matchId", fallbackMatch);
            if (date) nextUrl.searchParams.set("date", date);
            if (round) nextUrl.searchParams.set("round", round);
            console.log("🚀 [waiting][AUTO] total=1 감지, 좌석 선택으로 이동");
            navigate(nextUrl.pathname + nextUrl.search, { replace: true });
          }
          } else {
            console.log(
              "ℹ️ [waiting][QUEUE] 아직 대기열 미진입(내 userId 미포함):",
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
            console.warn("[waiting][DEQUEUE] 사용자 ID 없음, 처리 불가");
            return;
          }
          if (p.userId == null) {
            console.warn("[waiting][DEQUEUE] payload.userId 없음:", data);
            return;
          }
          if (hasDequeued) {
            return; // 중복 처리 방지
          }

          if (Number(p.userId) === Number(myUserId)) {
            setHasDequeued(true);
            // matchId 저장
            const numericMatchId =
              typeof p.matchId === "string" ? Number(p.matchId) : p.matchId;
            if (numericMatchId != null && !Number.isNaN(numericMatchId)) {
              useMatchStore.getState().setMatchId(numericMatchId as number);
            }
            console.log("✅ [waiting][DEQUEUE] 본인 티켓팅 성공!", {
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
            console.log("ℹ️ [waiting][DEQUEUE] 다른 유저 티켓팅 성공:", {
              dequeuedUserId: p.userId,
              myUserId,
            });
          }
        } else {
          console.log("ℹ️ [waiting][ws] QUEUE 외 이벤트:", evtType);
        }
      } catch (e) {
        console.error("❌ [waiting][QUEUE] 메시지 파싱 실패:", e);
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
  }, [
    stage,
    roomId,
    wsClient,
    subscriptionRef,
    hasDequeued,
    autoNavigated,
    matchIdFromStore,
    navigate,
    searchParams,
  ]);

  // Bridge 수신: 방 창에서 전달한 이벤트를 수신하여 동일하게 처리
  useEffect(() => {
    if (stage !== "queue") return;
    if (!roomId) return;
    if (!("BroadcastChannel" in window)) return;

    const channelName = `room-${roomId}-events`;
    let closed = false;
    const bc = new BroadcastChannel(channelName);
    console.log("🔗 [waiting][bridge] 채널 연결:", channelName);

    type QueueEntry = {
      ahead?: number;
      behind?: number;
      total?: number;
      lastUpdated?: number;
    };

    bc.onmessage = (ev: MessageEvent) => {
      if (closed) return;
      const data = ev.data as {
        eventType?: string;
        type?: string;
        payload?: unknown;
        timestamp?: number;
      };
      const evtType = data?.eventType || data?.type;
      console.log("📨 [waiting][bridge] 메시지 수신:", {
        eventType: evtType,
        timestamp: new Date().toISOString(),
      });

      if (evtType === "QUEUE_STATUS_UPDATE") {
        const myUserId = useAuthStore.getState().userId;
        const statuses = (
          data.payload as { queueStatuses?: Record<string, QueueEntry> }
        )?.queueStatuses;
        if (!statuses || myUserId == null) return;
        const key = String(myUserId);
        const raw =
          statuses[key] ??
          (statuses as unknown as Record<number, QueueEntry>)[
            myUserId as number
          ];
        if (raw) {
          const total = Number(raw.total ?? 0);
          const behind = Number(raw.behind ?? 0);
          setRank(total);
          setTotalQueue(total + behind);
          console.log("✅ [waiting][bridge] 대기열 갱신 성공:", {
            myUserId,
            total,
            behind,
          });

          // 임시 정책: total === 0 이면 좌석 선택 페이지로 이동
          if (total === 0 && !hasDequeued && !autoNavigated) {
            setAutoNavigated(true);
            const rtSec = searchParams.get("rtSec") ?? "0";
            const nrClicks = searchParams.get("nrClicks") ?? "0";
            const hallId = searchParams.get("hallId");
            const date = searchParams.get("date");
            const round = searchParams.get("round");
            const nextUrl = new URL(window.location.origin + paths.booking.selectSeat);
            nextUrl.searchParams.set("rtSec", rtSec);
            nextUrl.searchParams.set("nrClicks", nrClicks);
            if (hallId) nextUrl.searchParams.set("hallId", hallId);
            const fallbackMatch =
              matchIdFromStore != null ? String(matchIdFromStore) : searchParams.get("matchId");
            if (fallbackMatch) nextUrl.searchParams.set("matchId", fallbackMatch);
            if (date) nextUrl.searchParams.set("date", date);
            if (round) nextUrl.searchParams.set("round", round);
            console.log("🚀 [waiting][bridge][AUTO] total=1 감지, 좌석 선택으로 이동");
            navigate(nextUrl.pathname + nextUrl.search, { replace: true });
          }
        }
      } else if (evtType === "USER_DEQUEUED") {
        const myUserId = useAuthStore.getState().userId;
        const p = (data.payload ?? {}) as {
          userId?: number;
          matchId?: string | number;
          timestamp?: number;
        };
        if (myUserId == null || p.userId == null) return;
        if (hasDequeued) return;

        if (Number(p.userId) === Number(myUserId)) {
          setHasDequeued(true);
          const numericMatchId =
            typeof p.matchId === "string" ? Number(p.matchId) : p.matchId;
          if (numericMatchId != null && !Number.isNaN(numericMatchId)) {
            useMatchStore.getState().setMatchId(numericMatchId as number);
          }
          console.log("✅ [waiting][bridge] 본인 티켓팅 성공!", {
            myUserId,
            matchId: p.matchId,
          });
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
          console.log("ℹ️ [waiting][bridge] 다른 유저 티켓팅 성공:", {
            dequeuedUserId: p.userId,
            myUserId,
          });
        }
      }
    };

    return () => {
      closed = true;
      try {
        bc.close();
        console.log("🔌 [waiting][bridge] 채널 종료:", channelName);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("[waiting][bridge] close 실패:", err);
        }
      }
    };
  }, [stage, roomId, hasDequeued, autoNavigated, matchIdFromStore, navigate, searchParams]);
  // 대기열 진입 시 큐 등록 API 호출 (matchId가 있을 때만)
  useEffect(() => {
    if (stage !== "queue") return;
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
    return (
      <Viewport>
        <div className="w-full h-full flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-8 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-500" />
            <div className="text-xl font-extrabold text-gray-900 tracking-tight">
              예매 화면을 불러오는 중입니다.
            </div>
            <div className="mt-2 text-lg text-blue-600 font-extrabold">
              조금만 기다려주세요.
            </div>
          </div>
        </div>
      </Viewport>
    );
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
