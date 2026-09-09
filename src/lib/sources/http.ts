export interface FetchJsonOptions {
  headers?: HeadersInit;
  searchParams?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

export class SourceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodySnippet: string
  ) {
    super(message);
    this.name = "SourceHttpError";
  }
}

export function buildSourceUrl(baseUrl: string, params: FetchJsonOptions["searchParams"] = {}): string {
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);

  try {
    const response = await fetch(buildSourceUrl(url, options.searchParams), {
      headers: {
        accept: "application/json",
        "user-agent": "ENIGMA Verse Index/0.1.0",
        ...options.headers
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text();
      throw new SourceHttpError(
        `External source returned ${response.status}.`,
        response.status,
        body.slice(0, 500)
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

