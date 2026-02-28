import { useMemo, useState } from "react";

export default function ManageProperties({
  API_BASE,
  tenants,
  properties,
  setProperties,
  fetchTenants,
  fetchProperties,
  setStatus,
  onOpenProperty,
}) {
  // ✅ IMPORTANT: do NOT fall back to API_BASE (DocuCenter backend)
  const SYNDICATOR_BASE = import.meta.env.VITE_SYNDICATOR_URL;

  if (!SYNDICATOR_BASE) {
    console.warn("Missing VITE_SYNDICATOR_URL — CSV preview/apply will not work.");
  }

  const [form, setForm] = useState({
    name: "",
    suite: "",
    photoUrl: "",
  });

  // ✅ CSV update UI state (PROPERTIES)
  const [csvFile, setCsvFile] = useState(null);

  // ✅ PROPERTIES CSV matchKey should default to item_id (matches your working curl)
  const [matchKey, setMatchKey] = useState("item_id");
  const [dryRun, setDryRun] = useState(true); // start safe
  const [csvBusy, setCsvBusy] = useState(false);

  // ✅ Syndicator tenantId is NOT the same as Mongo tenant _id.
  // Your working curl uses tenantId=demo, so default to that.
  // Later we can make a dropdown if you add more syndicator tenants.
  const [syndicatorTenantId, setSyndicatorTenantId] = useState("demo");

  // ✅ Optional: show backend errors/preview rows right in UI
  const [csvReport, setCsvReport] = useState(null);

  const propertyHasTenants = useMemo(() => {
    const map = {};
    for (const p of properties) {
      map[p._id] = tenants.some((t) => t.propertyId === p._id);
    }
    return map;
  }, [properties, tenants]);

  // ✅ helper: parse response no matter what (JSON or text)
  async function readResponse(res) {
    const raw = await res.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch {
      // not JSON, keep raw
    }
    return { raw, data };
  }

  // ✅ helper: ping syndicator to confirm reachable (health route)
  async function pingSyndicator() {
    try {
      const url = `${SYNDICATOR_BASE}/api/health`;
      console.log("PING:", url);
      const res = await fetch(url);
      return res.ok;
    } catch {
      return false;
    }
  }

  const handleRepairPropertyLinks = async () => {
    setStatus("🛠 Repairing tenant property links...");

    try {
      const res = await fetch(`${API_BASE}/api/repair/tenant-property-ids`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "wallsecure",
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(`❌ Repair failed: ${data?.error || `Server error (${res.status})`}`);
        return;
      }

      const c = data?.counts || {};
      setStatus(
        `✅ Repair complete — Updated: ${c.updated || 0}, Skipped: ${c.skipped || 0}, Unresolved: ${c.unresolved || 0}`
      );

      await fetchTenants();
      await fetchProperties();
    } catch (err) {
      setStatus(`❌ Repair failed: ${err.message}`);
    }
  };

  const handleAddProperty = async (e) => {
    e.preventDefault();

    if (!SYNDICATOR_BASE) {
      return setStatus("❌ Missing VITE_SYNDICATOR_URL (points to syndicator backend).");
    }

    const name = form.name.trim();
    const suite = form.suite.trim();
    const photoUrl = form.photoUrl.trim();

    if (!name) return setStatus("❌ Property name is required");

    try {
      const res = await fetch(`${SYNDICATOR_BASE}/api/webflow/properties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "wallsecure",
        },
        body: JSON.stringify({ name, suite, photoUrl }),
      });

      const { raw, data } = await readResponse(res);

      if (!res.ok) {
        console.error("ADD PROPERTY FAIL:", res.status, raw);
        setStatus(`❌ Add failed (${res.status}): ${data?.error || raw || "Unknown error"}`);
        return;
      }

      setStatus(`✅ Property "${data.property?.name || name}" added`);
      if (data?.property) setProperties((prev) => [...prev, data.property]);
      setForm({ name: "", suite: "", photoUrl: "" });
    } catch (err) {
      setStatus(`⚠️ Syndicator offline (properties unavailable): ${err.message}`);
    }
  };

  const handleDeleteProperty = async (p) => {
    if (propertyHasTenants[p._id]) return;

    if (!SYNDICATOR_BASE) {
      return setStatus("❌ Missing VITE_SYNDICATOR_URL (points to syndicator backend).");
    }

    const ok = window.confirm(`Delete property "${p.name}"?\n\nThis cannot be undone.`);
    if (!ok) return;

    try {
      const res = await fetch(`${SYNDICATOR_BASE}/api/webflow/properties/${p._id}`, {
        method: "DELETE",
        headers: { "x-admin-key": "wallsecure" },
      });

      const { raw, data } = await readResponse(res);

      if (!res.ok) {
        console.error("DELETE PROPERTY FAIL:", res.status, raw);
        setStatus(`❌ Delete failed (${res.status}): ${data?.error || raw || "Unknown error"}`);
        return;
      }

      setProperties((prev) => prev.filter((x) => x._id !== p._id));
      setStatus(`✅ Property "${p.name}" deleted`);
    } catch (err) {
      setStatus(`⚠️ Syndicator offline (properties unavailable): ${err.message}`);
    }
  };

  // ✅ CSV PREVIEW (no write) — PROPERTIES ROUTE
  const handleCsvPreview = async () => {
    setCsvReport(null);

    if (!SYNDICATOR_BASE) {
      return setStatus("❌ Missing VITE_SYNDICATOR_URL (points to syndicator backend).");
    }
    if (!csvFile) return setStatus("❌ Please choose a CSV file first.");
    if (!syndicatorTenantId) return setStatus("❌ Missing syndicator tenantId.");

    setCsvBusy(true);
    setStatus("🔎 Previewing Properties CSV…");

    console.log("SYNDICATOR_BASE:", SYNDICATOR_BASE);
    console.log("Preview URL:", `${SYNDICATOR_BASE}/api/import/properties/csv`);

    const reachable = await pingSyndicator();
    if (!reachable) {
      setCsvBusy(false);
      return setStatus("❌ Cannot reach Syndicator backend (/api/health failed). Check URL/CORS/Render.");
    }

    try {
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("tenantId", syndicatorTenantId);
      fd.append("matchKey", matchKey);
      fd.append("mode", "update-only");
      fd.append("dryRun", "true");

      const res = await fetch(`${SYNDICATOR_BASE}/api/import/properties/csv`, {
        method: "POST",
        headers: { "x-admin-key": "wallsecure" },
        body: fd,
      });

      const { raw, data } = await readResponse(res);

      if (!res.ok) {
        console.error("CSV PREVIEW FAIL:", res.status, raw);
        setStatus(`❌ Preview failed (${res.status}): ${data?.error || raw || "Unknown error"}`);
        return;
      }

      setCsvReport({
        mode: "preview",
        runId: data?.runId,
        summary: data?.summary,
        headers: data?.headers,
        preview: data?.preview,
        applied: data?.applied,
      });

      setStatus(
        `✅ Preview OK — rows: ${data?.summary?.rows ?? "?"} (matchKey: ${data?.summary?.matchKey ?? matchKey})`
      );
    } catch (err) {
      setStatus(`❌ Preview failed: ${err.message}`);
    } finally {
      setCsvBusy(false);
    }
  };

  // ✅ CSV APPLY (writes to Webflow if dryRun=false) — PROPERTIES ROUTE
  const handleCsvApplyUpdate = async () => {
    setCsvReport(null);

    if (!SYNDICATOR_BASE) {
      return setStatus("❌ Missing VITE_SYNDICATOR_URL (points to syndicator backend).");
    }
    if (!csvFile) return setStatus("❌ Please choose a CSV file first.");
    if (!syndicatorTenantId) return setStatus("❌ Missing syndicator tenantId.");

    const ok = window.confirm(
      `Apply CSV update to Webflow PROPERTIES?\n\ntenantId: ${syndicatorTenantId}\nmatchKey: ${matchKey}\ndryRun: ${
        dryRun ? "true" : "false"
      }`
    );
    if (!ok) return;

    setCsvBusy(true);
    setStatus(dryRun ? "🧪 Dry run applying (Properties)..." : "🚀 Applying CSV updates to Webflow (Properties)…");

    console.log("Apply URL:", `${SYNDICATOR_BASE}/api/import/properties/csv/apply`);

    try {
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("tenantId", syndicatorTenantId);
      fd.append("matchKey", matchKey);
      fd.append("mode", "update-only");
      fd.append("dryRun", dryRun ? "true" : "false");

      const res = await fetch(`${SYNDICATOR_BASE}/api/import/properties/csv/apply`, {
        method: "POST",
        headers: { "x-admin-key": "wallsecure" },
        body: fd,
      });

      const { raw, data } = await readResponse(res);

      if (!res.ok) {
        console.error("CSV APPLY FAIL:", res.status, raw);
        setStatus(`❌ Apply failed (${res.status}): ${data?.error || raw || "Unknown error"}`);
        return;
      }

      setCsvReport({
        mode: "apply",
        runId: data?.runId,
        summary: data?.summary,
        headers: data?.headers,
        preview: data?.preview,
        applied: data?.applied,
      });

      const a = data?.applied || {};
      const errCount = a.errors?.length || 0;

      if (errCount) {
        console.warn("CSV APPLY ERRORS:", a.errors);
        setStatus(
          `⚠️ CSV Applied with errors — updated: ${a.updated || 0}, skipped: ${a.skipped || 0}, missing: ${
            a.missing?.length || 0
          }, errors: ${errCount} (see panel below)`
        );
      } else {
        setStatus(
          `✅ CSV Applied — updated: ${a.updated || 0}, skipped: ${a.skipped || 0}, missing: ${
            a.missing?.length || 0
          }, errors: 0`
        );
      }
    } catch (err) {
      setStatus(`❌ Apply failed: ${err.message}`);
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <section className="property-section">
      <div className="property-head">
        <h3 style={{ margin: 0 }}>🏢 Manage Properties</h3>
        <button type="button" className="back-button" onClick={handleRepairPropertyLinks}>
          🛠 Repair Property Links
        </button>
      </div>

      {/* ✅ Bulk CSV update panel (PROPERTIES) */}
      <div className="card" style={{ marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>📄 Bulk Update Properties (CSV)</h4>

        <div className="file-upload" style={{ flexWrap: "wrap" }}>
          <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />

          {/* ✅ Syndicator tenantId (matches your curl tenantId=demo) */}
          <input
            type="text"
            value={syndicatorTenantId}
            onChange={(e) => setSyndicatorTenantId(e.target.value)}
            placeholder="tenantId (e.g., demo)"
            style={{ minWidth: 180 }}
          />

          <select value={matchKey} onChange={(e) => setMatchKey(e.target.value)}>
            <option value="item_id">match: item_id (best)</option>
            <option value="slug">match: slug</option>
            <option value="name">match: name</option>
          </select>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry run
          </label>

          <button type="button" className="back-button" disabled={csvBusy} onClick={handleCsvPreview}>
            🔎 Preview
          </button>

          <button type="button" disabled={csvBusy} onClick={handleCsvApplyUpdate}>
            ✅ Update Properties
          </button>
        </div>

        {csvFile && (
          <div className="subtle" style={{ marginTop: 8 }}>
            Selected: {csvFile.name}
          </div>
        )}

        {!SYNDICATOR_BASE && (
          <div className="subtle" style={{ marginTop: 8 }}>
            ⚠️ Missing <b>VITE_SYNDICATOR_URL</b> — set it in Netlify env vars and redeploy.
          </div>
        )}

        {/* ✅ Show helpful response details (runId, summary, errors) */}
        {csvReport && (
          <div style={{ marginTop: 12 }}>
            <div className="subtle">
              <b>Run:</b> {csvReport.mode} {csvReport.runId ? `— ${csvReport.runId}` : ""}
            </div>

            {!!csvReport?.summary && (
              <div className="subtle" style={{ marginTop: 6 }}>
                <b>Summary:</b>{" "}
                {typeof csvReport.summary?.rows !== "undefined" ? `rows=${csvReport.summary.rows}` : ""}{" "}
                {csvReport.summary?.matchKey ? `• matchKey=${csvReport.summary.matchKey}` : ""}
              </div>
            )}

            {!!csvReport?.applied && (
              <div className="subtle" style={{ marginTop: 6 }}>
                <b>Applied:</b> updated={csvReport.applied.updated || 0} • skipped={csvReport.applied.skipped || 0} •
                missing={csvReport.applied.missing?.length || 0} • errors={csvReport.applied.errors?.length || 0}
              </div>
            )}

            {!!csvReport?.applied?.errors?.length && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(255,0,0,0.06)" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>⚠️ Errors</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {csvReport.applied.errors.slice(0, 10).map((err, idx) => (
                    <li key={idx} className="subtle">
                      {typeof err === "string" ? err : JSON.stringify(err)}
                    </li>
                  ))}
                </ul>
                {csvReport.applied.errors.length > 10 && (
                  <div className="subtle" style={{ marginTop: 6 }}>
                    Showing first 10 of {csvReport.applied.errors.length}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleAddProperty} style={{ marginTop: 12 }}>
        <input
          type="text"
          placeholder="New Property Name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />

        <input
          type="text"
          placeholder="Suite / Unit # (optional)"
          value={form.suite}
          onChange={(e) => setForm((p) => ({ ...p, suite: e.target.value }))}
        />

        <input
          type="text"
          placeholder="Photo URL (optional)"
          value={form.photoUrl}
          onChange={(e) => setForm((p) => ({ ...p, photoUrl: e.target.value }))}
        />

        <button type="submit">➕ Add Property</button>
      </form>

      {properties.length > 0 && (
        <div className="property-list">
          <h4>📍 Properties:</h4>
          <ul>
            {properties.map((p) => {
              const hasTenants = !!propertyHasTenants[p._id];

              return (
                <li key={p._id} className="property-row">
                  <button
                    type="button"
                    className="property-open"
                    onClick={() => onOpenProperty?.(p)}
                    title="Open property details"
                  >
                    {p.photoUrl && (
                      <img
                        src={p.photoUrl}
                        alt={p.name}
                        style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10 }}
                      />
                    )}

                    <div>
                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                      {p.suite && <div className="subtle">Suite: {p.suite}</div>}
                    </div>
                  </button>

                  <button
                    type="button"
                    className="danger-button small"
                    disabled={hasTenants}
                    title={hasTenants ? "Cannot delete: tenants still linked to this property" : "Delete property"}
                    onClick={() => handleDeleteProperty(p)}
                  >
                    🗑 Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}