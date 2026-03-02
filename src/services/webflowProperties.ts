// src/services/webflowProperties.ts
import { WebflowClient } from "../webflow/client.js";

const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_PROPERTIES;

// ✅ Update these slugs to match your Webflow Properties collection fields
const FIELDS = {
  name: "name",
  suite: "suite",
  photoUrl: "photo-url",
};

function getWebflowToken(): string {
  // support BOTH names (you’re using WEBFLOW_API_TOKEN elsewhere)
  const token = process.env.WEBFLOW_API_TOKEN || process.env.WEBFLOW_TOKEN;
  if (!token) throw new Error("Missing WEBFLOW_API_TOKEN (or WEBFLOW_TOKEN) env var");
  return token;
}

function assertConfig() {
  if (!COLLECTION_ID) throw new Error("Missing WEBFLOW_COLLECTION_PROPERTIES env var");
  getWebflowToken();
}

type WebflowV2Item = {
  id: string;
  isDraft?: boolean;
  isArchived?: boolean;
  lastPublished?: string;
  lastUpdated?: string;
  fieldData?: Record<string, any>;
};

export type PropertyDTO = {
  _id: string; // keep frontend happy
  webflowId: string;
  name: string;
  suite: string;
  photoUrl: string;
  isDraft: boolean;
  isArchived: boolean;
  lastPublished?: string;
  lastUpdated?: string;
};

function toProperty(item: WebflowV2Item): PropertyDTO {
  const fd = item?.fieldData || {};
  return {
    _id: item.id,
    webflowId: item.id,
    name: String(fd[FIELDS.name] || ""),
    suite: String(fd[FIELDS.suite] || ""),
    photoUrl: String(fd[FIELDS.photoUrl] || ""),
    isDraft: !!item.isDraft,
    isArchived: !!item.isArchived,
    lastPublished: item.lastPublished,
    lastUpdated: item.lastUpdated,
  };
}

export async function listWebflowProperties(): Promise<PropertyDTO[]> {
  assertConfig();

  const token = getWebflowToken();

  // NOTE: your WebflowClient constructor differs across repos.
  // If your client expects (token: string) use that.
  // If it expects ({ token }) this still works by casting.
  const wf: any = new (WebflowClient as any)({ token });

  const data = await wf.request(`/collections/${COLLECTION_ID}/items`, { method: "GET" });
  const items: WebflowV2Item[] = Array.isArray(data?.items) ? data.items : [];
  return items.map(toProperty);
}

export async function createWebflowProperty(input: {
  name: string;
  suite?: string;
  photoUrl?: string;
}): Promise<PropertyDTO> {
  assertConfig();

  const token = getWebflowToken();
  const wf: any = new (WebflowClient as any)({ token });

  const payload = {
    isDraft: false,
    fieldData: {
      [FIELDS.name]: input.name,
      [FIELDS.suite]: input.suite || "",
      [FIELDS.photoUrl]: input.photoUrl || "",
    },
  };

  const created = await wf.request(`/collections/${COLLECTION_ID}/items`, {
    method: "POST",
    body: payload,
  });

  const item = created?.item || created;
  return toProperty(item as WebflowV2Item);
}

export async function deleteWebflowProperty(itemId: string): Promise<{ ok: true }> {
  assertConfig();

  const token = getWebflowToken();
  const wf: any = new (WebflowClient as any)({ token });

  await wf.request(`/collections/${COLLECTION_ID}/items/${itemId}`, {
    method: "DELETE",
  });

  return { ok: true };
}