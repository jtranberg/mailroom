// server/webflow/client.js
const WEBFLOW_API_BASE = "https://api.webflow.com/v2";

export class WebflowClient {
  constructor({ token }) {
    if (!token) throw new Error("Missing Webflow token");
    this.token = token;
  }

  async request(path, { method = "GET", headers = {}, body } = {}) {
    const res = await fetch(`${WEBFLOW_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "Accept-Version": "2.0.0",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      const msg = json?.msg || json?.message || `Webflow API error ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = json;
      throw err;
    }

    return json;
  }
}