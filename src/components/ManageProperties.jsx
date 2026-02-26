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
  const SYNDICATOR_BASE = import.meta.env.VITE_SYNDICATOR_URL || API_BASE;

  const [form, setForm] = useState({
    name: "",
    suite: "",
    photoUrl: "",
  });

  const propertyHasTenants = useMemo(() => {
    const map = {};
    for (const p of properties) {
      map[p._id] = tenants.some((t) => t.propertyId === p._id);
    }
    return map;
  }, [properties, tenants]);

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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(`❌ Add failed: ${data?.error || `Server error (${res.status})`}`);
        return;
      }

      setStatus(`✅ Property "${data.property.name}" added`);
      setProperties((prev) => [...prev, data.property]);
      setForm({ name: "", suite: "", photoUrl: "" });
    } catch (err) {
      setStatus(`⚠️ Syndicator offline (properties unavailable): ${err.message}`);
    }
  };

  const handleDeleteProperty = async (p) => {
    if (propertyHasTenants[p._id]) return;

    const ok = window.confirm(`Delete property "${p.name}"?\n\nThis cannot be undone.`);
    if (!ok) return;

    try {
      const res = await fetch(`${SYNDICATOR_BASE}/api/webflow/properties/${p._id}`, {
        method: "DELETE",
        headers: {
          "x-admin-key": "wallsecure",
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(`❌ Delete failed: ${data?.error || res.status}`);
        return;
      }

      setProperties((prev) => prev.filter((x) => x._id !== p._id));
      setStatus(`✅ Property "${p.name}" deleted`);
    } catch (err) {
      setStatus(`⚠️ Syndicator offline (properties unavailable): ${err.message}`);
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

      <form onSubmit={handleAddProperty}>
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
                        style={{
                          width: 44,
                          height: 44,
                          objectFit: "cover",
                          borderRadius: 10,
                        }}
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
                    title={
                      hasTenants
                        ? "Cannot delete: tenants still linked to this property"
                        : "Delete property"
                    }
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