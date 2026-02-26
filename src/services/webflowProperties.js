// server/services/webflowProperties.js
import { WebflowClient } from "../webflow/client.js";

const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_PROPERTIES;

// ✅ Update these slugs to match your Webflow Properties collection fields
const FIELDS = {
  name: "name",          // Property name field slug (often "name")
  suite: "suite",        // e.g. "suite" or "suite-number"
  photoUrl: "photo-url", // e.g. "photo-url" (PlainText) for now
};

function assertConfig() {
  if (!process.env.WEBFLOW_TOKEN) throw new Error("Missing WEBFLOW_TOKEN env var");
  if (!COLLECTION_ID) throw new Error("Missing WEBFLOW_COLLECTION_PROPERTIES env var");
}

function toProperty(item) {
  const fd = item?.fieldData || {};
  return {
    _id: item?.id,               // keep your frontend happy
    webflowId: item?.id,
    name: fd[FIELDS.name] || "",
    suite: fd[FIELDS.suite] || "",
    photoUrl: fd[FIELDS.photoUrl] || "",
    isDraft: !!item?.isDraft,
    isArchived: !!item?.isArchived,
    lastPublished: item?.lastPublished,
    lastUpdated: item?.lastUpdated,
  };
}

export async function listWebflowProperties() {
  assertConfig();
  const wf = new WebflowClient({ token: process.env.WEBFLOW_TOKEN });

  // Webflow v2: GET /collections/:collectionId/items
  const data = await wf.request(`/collections/${COLLECTION_ID}/items`, { method: "GET" });
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(toProperty);
}

export async function createWebflowProperty({ name, suite = "", photoUrl = "" }) {
  assertConfig();
  const wf = new WebflowClient({ token: process.env.WEBFLOW_TOKEN });

  const payload = {
    isDraft: false,
    fieldData: {
      [FIELDS.name]: name,
      [FIELDS.suite]: suite,
      [FIELDS.photoUrl]: photoUrl,
    },
  };

  const created = await wf.request(`/collections/${COLLECTION_ID}/items`, {
    method: "POST",
    body: payload,
  });

  // v2 usually returns the created item (or an object containing it)
  const item = created?.item || created;
  return toProperty(item);
}

export async function deleteWebflowProperty(itemId) {
  assertConfig();
  const wf = new WebflowClient({ token: process.env.WEBFLOW_TOKEN });

  await wf.request(`/collections/${COLLECTION_ID}/items/${itemId}`, {
    method: "DELETE",
  });

  return { ok: true };
}