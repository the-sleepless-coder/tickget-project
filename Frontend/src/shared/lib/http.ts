export const ROOM_SERVER_BASE_URL =
  import.meta.env.VITE_ROOM_SERVER_URL ?? "http://localhost:8080";

export const TICKETING_SERVER_BASE_URL =
  import.meta.env.VITE_TICKETING_SERVER_URL ?? "http://localhost:8081";

type QueryParams = Record<string, string | number | boolean | undefined>;

type HttpOptions = {
  params?: QueryParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

function buildUrl(baseUrl: string, path: string, params?: QueryParams) {
  const url = new URL(path, baseUrl);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `${res.status} ${res.statusText}${text ? `: ${text}` : ""}`
    );
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

function createHeaders(extra?: Record<string, string>) {
  return { "Content-Type": "application/json", ...(extra ?? {}) };
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export function createHttpClient(baseUrl: string) {
  return {
    get: async <T>(path: string, options: HttpOptions = {}): Promise<T> => {
      const url = buildUrl(baseUrl, path, options.params);
      const res = await fetch(url, {
        method: "GET",
        headers: options.headers,
        signal: options.signal,
      });
      return parseJson<T>(res);
    },

    postJson: async <T>(
      path: string,
      body?: unknown,
      options: HttpOptions = {}
    ): Promise<T> => {
      const url = buildUrl(baseUrl, path, options.params);
      const res = await fetch(url, {
        method: "POST",
        headers: createHeaders(options.headers),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: options.signal,
      });
      return parseJson<T>(res);
    },

    postFormData: async <T>(
      path: string,
      formData: FormData,
      options: HttpOptions = {}
    ): Promise<T> => {
      const url = buildUrl(baseUrl, path, options.params);
      const res = await fetch(url, {
        method: "POST",
        // Do not set Content-Type explicitly for FormData
        headers: options.headers,
        body: formData,
        signal: options.signal,
      });
      return parseJson<T>(res);
    },

    delete: async <T>(
      path: string,
      body?: unknown,
      options: HttpOptions = {}
    ): Promise<T> => {
      const url = buildUrl(baseUrl, path, options.params);
      const init: RequestInit = {
        method: "DELETE",
        headers: createHeaders(options.headers),
        signal: options.signal,
      };
      if (body !== undefined) {
        if (isFormData(body)) {
          // If FormData body is passed for DELETE (rare), override headers
          init.headers = options.headers;
          init.body = body as FormData;
        } else {
          init.body = JSON.stringify(body);
        }
      }
      const res = await fetch(url, init);
      return parseJson<T>(res);
    },
  };
}

export const roomApi = createHttpClient(ROOM_SERVER_BASE_URL);
export const ticketingApi = createHttpClient(TICKETING_SERVER_BASE_URL);

export function toJsonBlob(value: unknown): Blob {
  return new Blob([JSON.stringify(value)], { type: "application/json" });
}
