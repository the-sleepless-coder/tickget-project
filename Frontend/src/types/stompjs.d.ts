declare module "stompjs" {
  export interface Frame {
    command?: string;
    headers?: Record<string, string>;
    body: string;
  }

  export interface Subscription {
    id?: string;
    unsubscribe: () => void;
  }

  export interface Client {
    connected: boolean;
    debug: (message: string) => void;
    connect: (
      headers: Record<string, string>,
      onConnect: (frame?: Frame) => void,
      onError?: (error: string | Frame) => void
    ) => void;
    disconnect: (onDisconnect?: () => void) => void;
    subscribe: (
      destination: string,
      callback: (message: Frame) => void,
      headers?: Record<string, string>
    ) => Subscription;
    send: (
      destination: string,
      headers?: Record<string, string>,
      body?: string
    ) => void;
  }

  export function over(ws: WebSocket): Client;
}
