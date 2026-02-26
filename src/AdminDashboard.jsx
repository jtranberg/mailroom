import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import ManageProperties from "./components/ManageProperties";

export default function AdminDashboard() {
  const [type, setType] = useState("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);

  const [selectedTenantId, setSelectedTenantId] = useState("");

  const [tenantForm, setTenantForm] = useState({
    name: "",
    email: "",
    unit: "",
    property: "", // stores propertyId (_id)
  });

  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const SYNDICATOR_BASE = import.meta.env.VITE_SYNDICATOR_URL || API_BASE;

  // Map for quick lookup: propertyId -> property object
  const propertyById = useMemo(() => {
    return Object.fromEntries(properties.map((p) => [p._id, p]));
  }, [properties]);

  // ✅ fetch helpers (also used after repair)
  async function fetchTenants() {
    try {
      const res = await fetch(`${API_BASE}/api/tenants`);
      const data = await res.json();
      if (res.ok) setTenants(Array.isArray(data) ? data : []);
    } catch (err) {
      setStatus(`❌ Failed to load tenants: ${err.message}`);
    }
  }

 async function fetchProperties() {
  try {
    const res = await fetch(`${SYNDICATOR_BASE}/api/webflow/properties`);
    const data = await res.json();
    if (res.ok) setProperties(Array.isArray(data) ? data : []);
  } catch (err) {
    setStatus(`⚠️ Properties service offline: ${err.message}`);
  }
}

  useEffect(() => {
    fetchTenants();
    fetchProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const propertyId = tenantForm.property;

    if (!name || !email || !unit || !propertyId) {
      setStatus("❌ Please fill out all tenant fields");
      return;
    }

    // ✅ duplicate guard (by email across ALL tenants)
    const exists = tenants.some((t) => String(t.email || "").trim().toLowerCase() === email);
    if (exists) {
      setStatus("⚠️ A tenant with this email already exists.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, unit, propertyId }),
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

  return (
    <div className="container">
      <div className="card admin-card">
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

        <ManageProperties
          API_BASE={API_BASE}
          tenants={tenants}
          properties={properties}
          setProperties={setProperties}
          fetchTenants={fetchTenants}
          fetchProperties={fetchProperties}
          setStatus={setStatus}
          onOpenProperty={(p) => navigate(`/properties/${p._id}`)}
        />

        <form onSubmit={handleTenantSubmit} className="tenant-form">
          <h3>Add / Archive Tenant</h3>

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
                property: t.propertyId || "",
              });

              setStatus(`✅ Selected tenant: ${t.name}`);
            }}
          >
            <option value="">Select Existing Tenant</option>
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

        {status && <p className="status">{status}</p>}
      </div>
    </div>
  );
}