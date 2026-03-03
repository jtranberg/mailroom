// src/PropertyUnits.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function PropertyUnits() {
  const { id } = useParams(); // propertyId from URL
  const navigate = useNavigate();

  const SYNDICATOR_BASE = import.meta.env.VITE_SYNDICATOR_URL || "";

  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      if (!SYNDICATOR_BASE) {
        setError("Missing VITE_SYNDICATOR_URL (syndicator server).");
        setLoading(false);
        return;
      }

      try {
        const url = `${SYNDICATOR_BASE}/api/webflow/units/search?propertyId=${encodeURIComponent(
          id
        )}&max=500`;

        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || `Server error (${res.status})`);
        }

        if (!cancelled) {
          setUnits(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (id) run();
    return () => {
      cancelled = true;
    };
  }, [id, SYNDICATOR_BASE]);

  return (
    <div className="container">
      <div className="card admin-card">
        <div className="admin-header">
          <h2>🏠 Property Units</h2>
          <button className="back-button" onClick={() => navigate("/admin")}>
            ⬅ Back to Admin
          </button>
        </div>

        {!SYNDICATOR_BASE && (
          <p className="status">
            ⚠️ Missing <b>VITE_SYNDICATOR_URL</b> — cannot load units.
          </p>
        )}

        {loading && <p className="status">Loading units…</p>}
        {error && <p className="status">❌ {error}</p>}

        {!loading && !error && (
          <>
            <p className="subtle">Units found: {units.length}</p>

            {units.length === 0 ? (
              <p className="status">No units found for this property.</p>
            ) : (
              <ul style={{ paddingLeft: 18 }}>
                {units.map((u) => {
                  const fd = u.fieldData || {};
                  const unitNumber = fd["unit-number"] ?? "";
                  const available = fd["available"];
                  const rent = fd["rent"];
                  const beds = fd["bedrooms"];
                  const baths = fd["bathrooms"];

                  return (
                    <li key={u.id} style={{ marginBottom: 10 }}>
                      <div style={{ fontWeight: 800 }}>
                        {fd.name || "Unit"}{" "}
                        {unitNumber ? `— Unit ${unitNumber}` : ""}
                      </div>
                      <div className="subtle">
                        {available !== undefined ? `Available: ${String(available)}` : ""}
                        {rent != null ? ` • Rent: $${rent}` : ""}
                        {beds != null ? ` • Beds: ${beds}` : ""}
                        {baths != null ? ` • Baths: ${baths}` : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}