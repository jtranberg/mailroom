// server/webflow/client.ts
const WEBFLOW_API_BASE = "https://api.webflow.com/v2";

export type WebflowHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type WebflowRequestOptions = {
  method?: WebflowHttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
};

export type WebflowError = Error & {
  status?: number;
  payload?: unknown;
};

export class WebflowClient {
  private token: string;

  constructor({ token }: { token: string }) {
    if (!token) throw new Error("Missing Webflow token");
    this.token = token;
  }

  async request<T = unknown>(path: string, opts: WebflowRequestOptions = {}): Promise<T> {
    const { method = "GET", headers = {}, body } = opts;

    const res = await fetch(`${WEBFLOW_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        // Webflow Data API v2 uses this header:
        "accept-version": "2.0.0",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      const msg = json?.msg || json?.message || `Webflow API error ${res.status}`;
      const err = new Error(msg) as WebflowError;
      err.status = res.status;
      err.payload = json;
      throw err;
    }

    return json as T;
  }
}