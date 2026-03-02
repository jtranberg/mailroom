// server/services/webflowProperties.js
import { WebflowClient } from "../webflow/client.js";

// Webflow Properties field slugs (adjust if yours differ)
const FIELDS = {
  name: "name",
  suite: "suite",
  photoUrl: "photo-url",
};

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

function getClient() {
  // ✅ IMPORTANT: your TS client expects WEBFLOW_API_TOKEN (not WEBFLOW_TOKEN)
  const token = process.env.WEBFLOW_API_TOKEN || process.env.WEBFLOW_TOKEN;
  if (!token) throw new Error("Missing WEBFLOW_API_TOKEN env var");
  return new WebflowClient(token);
}

function toProperty(item) {
  const fd = item?.fieldData || {};
  return {
    _id: item?.id,
    webflowId: item?.id,
    name: String(fd[FIELDS.name] || ""),
    suite: String(fd[FIELDS.suite] || ""),
    photoUrl: String(fd[FIELDS.photoUrl] || ""),
    isDraft: !!item?.isDraft,
    isArchived: !!item?.isArchived,
    lastPublished: item?.lastPublished,
    lastUpdated: item?.lastUpdated,
  };
}

export async function listWebflowProperties() {
  const collectionId = mustEnv("WEBFLOW_COLLECTION_PROPERTIES");
  const wf = getClient();

  // ✅ use public method from your TS client
  const items = await wf.fetchAllItems(collectionId, {
    includeDrafts: true,
    includeArchived: true,
  });

  return items.map(toProperty);
}

export async function createWebflowProperty({ name, suite = "", photoUrl = "" }) {
  const collectionId = mustEnv("WEBFLOW_COLLECTION_PROPERTIES");
  const wf = getClient();

  const created = await wf.createItem(collectionId, {
    fieldData: {
      [FIELDS.name]: name,
      [FIELDS.suite]: suite,
      [FIELDS.photoUrl]: photoUrl,
    },
  });

  return toProperty(created);
}

export async function deleteWebflowProperty(itemId) {
  const collectionId = mustEnv("WEBFLOW_COLLECTION_PROPERTIES");
  const wf = getClient();

  // ✅ Your TS client didn't include deleteItem yet, so we do one of these:
  // Option A (recommended): add deleteItem() to client.ts
  // Option B: temporarily use updateItem() to archive, but that's not delete.

  if (typeof wf.deleteItem !== "function") {
    throw new Error("WebflowClient.deleteItem is not implemented. Add it to src/webflow/client.ts");
  }

  await wf.deleteItem(collectionId, itemId);
  return { ok: true };
}