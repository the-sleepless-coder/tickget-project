import { Outlet } from "react-router-dom";
import ScrollToTop from "../routes/ScrollToTop";
import { useEffect, useRef } from "react";
import {
  createStompClient,
  connectStompClient,
  disconnectStompClient,
  subscribe,
  type StompClient,
  type Subscription,
} from "../../shared/lib/websocket";
import { useWebSocketStore } from "../../shared/lib/websocket-store";
import { useAuthStore } from "../../features/auth/store";

export default function PlainLayout() {
  const isLoggedIn = !!useAuthStore((s) => s.accessToken);
  const setClient = useWebSocketStore((s) => s.setClient);
  const clientRef = useRef<StompClient | null>(null);
  const userSubscriptionRef = useRef<Subscription | null>(null);

  // 새로고침 감지: 페이지 로드 시 새로고침 여부 확인
  const isReload = (() => {
    try {
      const entries = performance.getEntriesByType(
        "navigation"
      ) as PerformanceNavigationTiming[];
      if (entries.length > 0 && entries[0].type === "reload") {
        return true;
      }
      const nav = (
        performance as {
          navigation?: { type?: number };
        }
      ).navigation;
      if (nav && nav.type === 1) {
        // TYPE_RELOAD = 1
        return true;
      }
    } catch {
      // 확인 실패는 새로고침이 아닌 것으로 간주
    }
    return false;
  })();

  // 새로고침 직후 일정 시간 동안 WebSocket 퇴장/강제 종료 이벤트 무시 (5초)
  const reloadIgnoreUntilRef = useRef<number>(isReload ? Date.now() + 5000 : 0);

  useEffect(() => {
    const userId = useAuthStore.getState().userId;

    // 개인 메시지 구독 로직을 함수로 분리
    const doSubscribeUserMessage = (client: StompClient) => {
      if (userId == null) return;

      // 이미 구독되어 있으면 스킵
      if (userSubscriptionRef.current) {
        return;
      }

      const userDestination = `/user/${userId}`;
      const subscription = subscribe(client, userDestination, (message) => {
        try {
          const event = JSON.parse(message.body);
          if (import.meta.env.DEV) {
            console.log("📨 [개인 메시지] 수신:", {
              destination: message.headers.destination,
              eventType: event.eventType,
              body: event,
            });
          }

          // 새로고침 직후 일정 시간 동안 퇴장/강제 종료 이벤트 무시
          const now = Date.now();
          if (
            reloadIgnoreUntilRef.current > 0 &&
            now < reloadIgnoreUntilRef.current &&
            (event.eventType === "USER_LEFT" ||
              event.eventType === "USER_EXITED" ||
              event.eventType === "FORCE_DISCONNECT")
          ) {
            if (import.meta.env.DEV) {
              console.log(
                "⏭️ [개인 메시지] 새로고침 직후이므로 USER_LEFT/USER_EXITED/FORCE_DISCONNECT 무시:",
                {
                  eventType: event.eventType,
                  remainingMs: reloadIgnoreUntilRef.current - now,
                  event,
                }
              );
            }
            return;
          }

          // 결과 페이지에서는 USER_LEFT 이벤트 무시
          const currentPath = window.location.pathname;
          const isGameResultPage = currentPath.includes("/game-result");

          if (
            isGameResultPage &&
            (event.eventType === "USER_LEFT" ||
              event.eventType === "USER_EXITED")
          ) {
            return; // 결과 페이지에서는 퇴장 알림 무시
          }

          if (event.eventType === "FORCE_DISCONNECT") {
            const payload = event.payload as
              | {
                  reason?: string;
                  message?: string;
                  timestamp?: number;
                }
              | undefined;
            const disconnectMessage =
              payload?.message ||
              event.message ||
              "다른 기기에서 로그인되어 연결이 종료됩니다.";

            if (import.meta.env.DEV) {
              console.warn("🚨 [FORCE_DISCONNECT] 강제 연결 종료:", {
                reason: payload?.reason,
                message: disconnectMessage,
                timestamp: payload?.timestamp || event.timestamp,
              });
            }

            // 결과 페이지에서는 자동 로그아웃 대신 알림만 표시하고 세션은 유지
            const currentPathForForce = window.location.pathname;
            const isGameResultForForce =
              currentPathForForce.includes("/game-result");

            if (isGameResultForForce) {
              alert(
                `${disconnectMessage}\n\n(결과 화면은 유지되며, 새로 접속 시 다시 로그인해야 할 수 있습니다.)`
              );
              // WebSocket 연결만 정리하고 인증 상태는 유지
              disconnectStompClient(client);
              return;
            }

            // 일반 페이지에서는 기존 동작 유지: 알림 + 로그아웃
            alert(disconnectMessage);
            disconnectStompClient(client);
            useAuthStore.getState().clearAuth();
          }
        } catch (e) {
          console.error("❌ [개인 메시지] 파싱 실패:", e, message.body);
        }
      });

      if (subscription) {
        userSubscriptionRef.current = subscription;
        if (import.meta.env.DEV) {
          console.log(`✅ [개인 메시지] 구독 성공: ${userDestination}`);
        }
      } else {
        console.warn("⚠️ [개인 메시지] 구독 실패");
      }
    };

    if (isLoggedIn) {
      // 먼저 기존 웹소켓 클라이언트 확인 (store에서)
      const existingClient = useWebSocketStore.getState().client;

      if (existingClient && existingClient.connected) {
        // 기존 연결이 있고 연결되어 있으면 재사용
        if (import.meta.env.DEV) {
          console.log("✅ [PlainLayout] 기존 WebSocket 연결 재사용");
        }
        clientRef.current = existingClient;

        // 개인 메시지 구독이 없으면 구독
        if (!userSubscriptionRef.current) {
          doSubscribeUserMessage(existingClient);
        }
      } else if (!clientRef.current) {
        // 기존 연결이 없거나 끊어진 경우에만 새로 생성
        if (import.meta.env.DEV) {
          console.log("🆕 [PlainLayout] 새 WebSocket 연결 생성");
        }
        const client = createStompClient({
          onConnect: () => {
            if (import.meta.env.DEV) {
              console.log("✅ [PlainLayout] WebSocket 연결 완료");
            }

            // 개인 메시지 구독: /user/{userId}
            doSubscribeUserMessage(client);
          },
          onDisconnect: () => {
            if (import.meta.env.DEV) {
              console.log("⚠️ [PlainLayout] WebSocket 연결 끊김");
            }
            // 구독 해제
            if (userSubscriptionRef.current) {
              userSubscriptionRef.current.unsubscribe();
              userSubscriptionRef.current = null;
            }
          },
          onError: (err) => {
            if (import.meta.env.DEV) {
              console.error("❌ [PlainLayout] WebSocket 에러:", err);
            }
            // 구독 해제
            if (userSubscriptionRef.current) {
              userSubscriptionRef.current.unsubscribe();
              userSubscriptionRef.current = null;
            }
          },
        });
        clientRef.current = client;
        setClient(client);
        connectStompClient(client);
      }
    }

    return () => {
      // PlainLayout 언마운트 시 개인 메시지 구독만 해제
      // WebSocket 클라이언트는 다른 컴포넌트(MainLayout, ExterparkRoom)에서도 사용 중일 수 있으므로 끊지 않음
      if (userSubscriptionRef.current) {
        if (import.meta.env.DEV) {
          console.log("🔌 [PlainLayout] 개인 메시지 구독 해제");
        }
        userSubscriptionRef.current.unsubscribe();
        userSubscriptionRef.current = null;
      }
      // clientRef는 초기화하지만 클라이언트 자체는 끊지 않음
      clientRef.current = null;
    };
  }, [isLoggedIn, setClient]);

  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}
