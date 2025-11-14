import { Client } from "@stomp/stompjs";
import type { IMessage, StompSubscription } from "@stomp/stompjs";
// React/Vite 환경에서 'global is not defined' 이슈를 피하기 위해 dist 빌드 사용
import SockJS from "sockjs-client/dist/sockjs";
import { ROOM_SERVER_BASE_URL } from "./http";
import { useAuthStore } from "../../features/auth/store";

// 구독 prefix (백엔드: enableSimpleBroker("/topic"))
export const TOPIC_PREFIX = "/topic";
// 애플리케이션 destination prefix (백엔드: setApplicationDestinationPrefixes("/app"))
export const APP_PREFIX = "/app";

// WebSocket URL 구성
// ROOM_SERVER_BASE_URL 예: "https://tickget.kr/api/v1/dev/rms" 또는 "/api/v1/dev/rms"
// 최종 엔드포인트: "<ABS_BASE>/ws/rooms" (예: https://tickget.kr/api/v1/dev/rms/ws/rooms)
export function buildWebSocketUrl(baseUrl: string): string {
  const wsSuffix = "/ws/rooms";
  // 항상 절대 URL로 생성 (프록시 우회, 직접 백엔드로 연결)
  const apiOrigin = import.meta.env.VITE_API_ORIGIN || "https://tickget.kr";
  const absoluteBase =
    baseUrl.startsWith("http://") || baseUrl.startsWith("https://")
      ? baseUrl.replace(/\/$/, "")
      : new URL(baseUrl.replace(/\/$/, ""), apiOrigin).toString();
  return `${absoluteBase}${wsSuffix}`;
}

// 최종 WebSocket 엔드포인트
const WS_URL = buildWebSocketUrl(ROOM_SERVER_BASE_URL);
if (import.meta.env.DEV) {
  // 개발 중 실제 연결 URL 확인용
  console.log("WebSocket URL:", WS_URL);
}

// 타입 별칭
export type StompClient = Client;
export type StompMessage = IMessage;
export type Subscription = StompSubscription;

// 연결 옵션
export interface WebSocketOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  reconnectDelay?: number;
  heartbeatIncoming?: number;
  heartbeatOutgoing?: number;
  userId?: number; // STOMP CONNECT 헤더로 전달할 userId (선택)
  headers?: Record<string, string>; // 추가 커넥트 헤더
}

// STOMP 클라이언트 생성
export function createStompClient(options: WebSocketOptions = {}): Client {
  const {
    onConnect,
    onDisconnect,
    onError,
    reconnectDelay = 5000,
    heartbeatIncoming = 0,
    heartbeatOutgoing = 0,
    userId,
    headers = {},
  } = options;

  // 액세스 토큰 (API 요청 시 필요, STOMP CONNECT 헤더에도 포함 가능)
  const { accessToken, userId: storeUserId } = useAuthStore.getState();

  // SockJS 소켓 생성
  const socketFactory = () => {
    if (import.meta.env.DEV) {
      console.log("SockJS 연결 시도:", WS_URL);
    }
    return new SockJS(WS_URL);
  };

  // STOMP CONNECT 헤더
  const connectHeaders: Record<string, string> = { ...headers };
  if (accessToken) {
    connectHeaders.Authorization = `Bearer ${accessToken}`;
    if (import.meta.env.DEV) {
      console.log(
        "STOMP CONNECT Authorization 헤더 준비:",
        `Bearer ${accessToken.substring(0, 12)}...`
      );
    }
  }
  // userId: 옵션 > 스토어 순으로 설정
  const resolvedUserId =
    userId ?? (storeUserId != null ? String(storeUserId) : undefined);
  if (resolvedUserId != null) {
    connectHeaders.userId = String(resolvedUserId);
    if (import.meta.env.DEV) {
      console.log("STOMP CONNECT userId 헤더 준비:", connectHeaders.userId);
    }
  }

  const client = new Client({
    webSocketFactory: socketFactory,
    connectHeaders,
    reconnectDelay,
    heartbeatIncoming,
    heartbeatOutgoing,
    debug: (str) => {
      if (import.meta.env.DEV) {
        console.log("[STOMP]", str);
      }
    },
  });

  client.onConnect = () => {
    if (import.meta.env.DEV) {
      console.log("WebSocket 연결 성공");
    }
    onConnect?.();
  };

  client.onDisconnect = () => {
    if (import.meta.env.DEV) {
      console.log("WebSocket 연결 끊김");
    }
    onDisconnect?.();
  };

  client.onStompError = (frame) => {
    const message = frame.headers["message"] || "STOMP 에러";
    if (import.meta.env.DEV) {
      console.error("STOMP 에러:", message, frame.body || "");
    }
    onError?.(new Error(message));
  };

  client.onWebSocketError = (event) => {
    if (import.meta.env.DEV) {
      console.error("WebSocket 에러:", event);
    }
    onError?.(new Error("WebSocket 연결 에러"));
  };

  return client;
}

// 활성화
export function connectStompClient(client: Client): void {
  if (!client.active) {
    if (import.meta.env.DEV) {
      console.log("STOMP 클라이언트 활성화");
    }
    client.activate();
  }
}

// 비활성화
export function disconnectStompClient(client: Client): void {
  if (client.active) {
    client.deactivate();
  }
}

// 구독
export function subscribe(
  client: Client,
  destination: string,
  callback: (message: StompMessage) => void
): Subscription | null {
  if (!client.connected) {
    if (import.meta.env.DEV) {
      console.warn("STOMP 클라이언트가 연결되지 않았습니다.");
    }
    return null;
  }

  // /user/로 시작하는 destination은 prefix를 붙이지 않음 (STOMP user destination)
  const fullDestination = destination.startsWith("/user/")
    ? destination
    : destination.startsWith(TOPIC_PREFIX)
      ? destination
      : `${TOPIC_PREFIX}${destination.startsWith("/") ? destination : `/${destination}`}`;

  return client.subscribe(fullDestination, callback);
}

// 메시지 전송
export function sendMessage(
  client: Client,
  destination: string,
  body: unknown,
  headers?: Record<string, string>
): void {
  if (!client.connected) {
    if (import.meta.env.DEV) {
      console.warn("STOMP 클라이언트가 연결되지 않았습니다.");
    }
    return;
  }

  const fullDestination = destination.startsWith(APP_PREFIX)
    ? destination
    : `${APP_PREFIX}${destination.startsWith("/") ? destination : `/${destination}`}`;

  client.publish({
    destination: fullDestination,
    body: JSON.stringify(body),
    headers: headers || {},
  });
}
