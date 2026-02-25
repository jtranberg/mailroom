import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [type, setType] = useState("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [newProperty, setNewProperty] = useState("");

  const [selectedTenantId, setSelectedTenantId] = useState("");

  const [tenantForm, setTenantForm] = useState({
    name: "",
    email: "",
    unit: "",
    property: "", // this will now store propertyId (_id)
  });

  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // Map for quick lookup: propertyId -> property object
  const propertyById = useMemo(() => {
    return Object.fromEntries(properties.map((p) => [p._id, p]));
  }, [properties]);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tenants`);
        const data = await res.json();
        if (res.ok) setTenants(Array.isArray(data) ? data : []);
      } catch (err) {
        setStatus(`❌ Failed to load tenants: ${err.message}`);
      }
    };

    const fetchProperties = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/properties`);
        const data = await res.json();
        if (res.ok) setProperties(Array.isArray(data) ? data : []);
      } catch (err) {
        setStatus(`❌ Failed to load properties: ${err.message}`);
      }
    };

    fetchTenants();
    fetchProperties();
  }, [API_BASE]);

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!type || !label || !file) {
      setStatus("❌ Please fill out all fields");
      return;
    }

    const formData = new FormData();
    formData.append("type", type);
    formData.append("label", label);
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/documents`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus(`✅ Uploaded: ${data?.document?.label || "Document"}`);
        setType("");
        setLabel("");
        setFile(null);
      } else {
        setStatus(`❌ Upload failed: ${data?.error || "Unknown error"}`);
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  const handleTenantSubmit = async (e) => {
    e.preventDefault();

    const name = tenantForm.name.trim();
    const email = tenantForm.email.trim().toLowerCase();
    const unit = tenantForm.unit.trim();
    const propertyId = tenantForm.property; // now a real property _id

    if (!name || !email || !unit || !propertyId) {
      setStatus("❌ Please fill out all tenant fields");
      return;
    }

    // ✅ duplicate guard (by email across ALL tenants)
    const exists = tenants.some(
      (t) => String(t.email || "").trim().toLowerCase() === email
    );
    if (exists) {
      setStatus("⚠️ A tenant with this email already exists.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          unit,
          propertyId, // ✅ correct
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(`❌ Add failed: ${data?.error || `Server error (${res.status})`}`);
        return;
      }

      setStatus(`✅ Tenant ${data.tenant.name} added.`);
      setTenantForm({ name: "", email: "", unit: "", property: "" });
      setSelectedTenantId("");

      setTenants((prev) => [...prev, data.tenant]);
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  // ✅ Archive tenant by SELECTED tenant (no typing email needed)
  const handleArchiveSelected = async () => {
    if (!selectedTenantId) {
      setStatus("❌ Select a tenant first.");
      return;
    }

    const target = tenants.find((t) => t._id === selectedTenantId);
    if (!target) {
      setStatus("⚠️ Selected tenant not found.");
      return;
    }

    const propName = propertyById[target.propertyId]?.name || "Unknown";

    const ok = window.confirm(
      `Archive tenant?\n\n${target.name} (${target.email})\nUnit ${target.unit}\nProperty: ${propName}\n\nNotes + emails will be kept.`
    );
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/api/tenants/${target._id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(`❌ Archive failed: ${data?.error || `Server error (${res.status})`}`);
        return;
      }

      setStatus(`✅ Archived tenant: ${target.name}`);
      setTenants((prev) => prev.filter((t) => t._id !== target._id));

      setSelectedTenantId("");
      setTenantForm({ name: "", email: "", unit: "", property: "" });
    } catch (err) {
      setStatus(`❌ Archive failed: ${err.message}`);
    }
  };

  const handleAddProperty = async (e) => {
    e.preventDefault();
    if (!newProperty.trim()) return setStatus("❌ Property name is required");

    try {
      const res = await fetch(`${API_BASE}/api/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProperty.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus(`✅ Property "${data.property.name}" added`);
        setProperties((prev) => [...prev, data.property]);
        setNewProperty("");
      } else {
        setStatus(`❌ Add failed: ${data?.error || "Unknown error"}`);
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <h2>🛠️ Admin Dashboard</h2>
          <button className="back-button" onClick={() => navigate("/")}>
            ⬅ Back to App
          </button>
        </div>

        <form onSubmit={handleUpload}>
          <h3>Upload PDF Document</h3>
          <input
            type="text"
            placeholder="Document Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
          <input
            type="text"
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button type="submit">📤 Upload Document</button>
        </form>

        <section className="property-section">
          <h3>🏢 Manage Properties</h3>
          <form onSubmit={handleAddProperty}>
            <input
              type="text"
              placeholder="New Property Name"
              value={newProperty}
              onChange={(e) => setNewProperty(e.target.value)}
            />
            <button type="submit">➕ Add Property</button>
          </form>

          {properties.length > 0 && (
            <div className="property-list">
              <h4>📍 Properties:</h4>
              <ul>
                {properties.map((p) => (
                  <li key={p._id}>{p.name}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <form onSubmit={handleTenantSubmit} className="tenant-form">
          <h3>Add / Archive Tenant</h3>

          {/* ✅ Select existing tenant */}
          <select
          
            value={selectedTenantId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedTenantId(id);

              if (!id) {
                setTenantForm({ name: "", email: "", unit: "", property: "" });
                return;
              }

              const t = tenants.find((x) => x._id === id);
              if (!t) return;

              setTenantForm({
                name: t.name || "",
                email: t.email || "",
                unit: t.unit || "",
                property: t.propertyId || "", // expects tenant.propertyId is property _id
              });

              setStatus(`✅ Selected tenant: ${t.name}`);
            }}
          >
            <option value="disabled">Select Existing Tenant</option>
            {tenants.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name} — Unit {t.unit} ({t.email})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Name"
            value={tenantForm.name}
            onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
          />

          <input
            type="email"
            placeholder="Email"
            value={tenantForm.email}
            onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
          />

          <input
            type="text"
            placeholder="Unit #"
            value={tenantForm.unit}
            onChange={(e) => setTenantForm({ ...tenantForm, unit: e.target.value })}
          />

          {/* ✅ Property select uses property _id */}
          <select
            value={tenantForm.property}
            onChange={(e) => setTenantForm({ ...tenantForm, property: e.target.value })}
          >
            <option value="">Select Property</option>
            {properties.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="tenant-actions">
            <button type="submit">➕ Add Tenant</button>
            <button type="button" className="danger-button" onClick={handleArchiveSelected}>
              🗑 Archive Selected
            </button>
          </div>
        </form>

        {tenants.length > 0 && (
          <div className="tenant-list">
            <h4>🧑‍💼 Tenants:</h4>
            <ul>
              {tenants.map((t) => (
                <li key={t._id}>
                  {t.name} ({t.unit}) — {propertyById[t.propertyId]?.name || t.propertyId}
                </li>
              ))}
            </ul>
          </div>
        )}

        {status && <p className="status">{status}</p>}
      </div>
    </div>
  );
}