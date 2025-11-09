import * as Stomp from "stompjs";
import SockJS from "sockjs-client";

export type WebSocketEvent = {
  eventType: string;
  roomId: number;
  timestamp: number;
  message?: string;
  payload?: unknown;
};

type ConnectHandlers = {
  onConnected?: () => void;
  onError?: (error: unknown) => void;
};

let stompClient: Stomp.Client | null = null;
let currentSubscription: Stomp.Subscription | null = null;

function toWsScheme(url: string): string {
  // http -> ws, https -> wss
  return url.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

function toHttpScheme(url: string): string {
  // ws -> http, wss -> https
  return url.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
}

function joinPath(base: string, path: string): string {
  if (!base) return path;
  if (base.endsWith("/") && path.startsWith("/")) return base + path.slice(1);
  if (!base.endsWith("/") && !path.startsWith("/")) return `${base}/${path}`;
  return base + path;
}

function resolveWsUrl(wsPath: string): string {
  // 우선순위: VITE_ROOM_SERVER_WS_URL > (VITE_API_ORIGIN or window.origin) + wsPath
  const override =
    (import.meta.env.VITE_ROOM_SERVER_WS_URL as string | undefined) ?? "";

  if (override) {
    return override.includes("://") ? override : toWsScheme(override);
  }

  const origin =
    (import.meta.env.VITE_API_ORIGIN as string | undefined) ??
    window.location.origin;

  const base = toWsScheme(origin);
  return joinPath(base, wsPath);
}

function resolveSockJsUrl(path: string): string {
  // 우선순위: VITE_ROOM_SERVER_SOCKJS_URL > (VITE_API_ORIGIN or window.origin) + path
  const override =
    (import.meta.env.VITE_ROOM_SERVER_SOCKJS_URL as string | undefined) ?? "";
  if (override) {
    return override.includes("://") ? override : toHttpScheme(override);
  }
  const origin =
    (import.meta.env.VITE_API_ORIGIN as string | undefined) ??
    window.location.origin;
  return joinPath(origin, path);
}

type Transport = "websocket" | "sockjs" | "auto";

function getConfiguredTransport(): Transport {
  const raw =
    (import.meta.env.VITE_WS_TRANSPORT as string | undefined) ?? "auto";
  const val = raw.toLowerCase();
  if (val === "websocket" || val === "sockjs" || val === "auto") return val;
  return "auto";
}

function buildStompClient(transport: "websocket" | "sockjs"): Stomp.Client {
  if (transport === "sockjs") {
    const httpUrl = resolveSockJsUrl("/ws/rooms");
    const sock = new SockJS(httpUrl);
    const client = Stomp.over(sock as unknown as WebSocket);
    client.debug = () => {};
    return client;
  }
  const wsUrl = resolveWsUrl("/ws/rooms");
  const ws = new WebSocket(wsUrl);
  const client = Stomp.over(ws);
  client.debug = () => {};
  return client;
}

export function connect(handlers: ConnectHandlers = {}): void {
  if (stompClient?.connected) {
    handlers.onConnected?.();
    return;
  }

  const pref = getConfiguredTransport();
  let triedWebSocket = false;
  let triedSockJs = false;

  const tryConnect = (t: "websocket" | "sockjs") => {
    if (t === "websocket") triedWebSocket = true;
    if (t === "sockjs") triedSockJs = true;

    const client = buildStompClient(t);
    client.connect(
      {},
      () => {
        stompClient = client;
        handlers.onConnected?.();
      },
      (error) => {
        if (pref === "auto") {
          if (t === "websocket" && !triedSockJs) {
            tryConnect("sockjs");
            return;
          }
          if (t === "sockjs" && !triedWebSocket) {
            tryConnect("websocket");
            return;
          }
        }
        handlers.onError?.(error);
      }
    );
  };

  if (pref === "sockjs") {
    tryConnect("sockjs");
  } else if (pref === "websocket") {
    tryConnect("websocket");
  } else {
    // auto: 우선 WebSocket 시도, 실패 시 SockJS
    tryConnect("websocket");
  }
}

export function disconnect(): void {
  if (currentSubscription) {
    try {
      currentSubscription.unsubscribe();
    } catch {
      // noop
    } finally {
      currentSubscription = null;
    }
  }
  if (stompClient) {
    try {
      stompClient.disconnect();
    } finally {
      stompClient = null;
    }
  }
}

export function isConnected(): boolean {
  return Boolean(stompClient?.connected);
}

export function subscribeRoom(
  roomId: number,
  onMessage: (event: WebSocketEvent) => void
): void {
  if (!stompClient?.connected) {
    throw new Error(
      "WebSocket이 연결되지 않았습니다. 먼저 connect()를 호출하세요."
    );
  }

  // 기존 구독 해제
  if (currentSubscription) {
    try {
      currentSubscription.unsubscribe();
    } catch {
      // noop
    } finally {
      currentSubscription = null;
    }
  }

  const destination = `/topic/rooms/${roomId}`;
  currentSubscription = stompClient.subscribe(destination, (message) => {
    try {
      const evt = JSON.parse(message.body) as WebSocketEvent;
      onMessage(evt);
    } catch (e) {
      // 포맷 오류는 무시
      console.warn("Invalid WebSocket message:", e);
    }
  });
}

export function unsubscribeRoom(): void {
  if (currentSubscription) {
    try {
      currentSubscription.unsubscribe();
    } finally {
      currentSubscription = null;
    }
  }
}
