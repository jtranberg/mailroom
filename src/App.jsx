import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [status, setStatus] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const ADMIN_SECRET = "wallsecure";
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/documents`);
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Failed to fetch documents:", err);
    }
  };

  const fetchPropertiesAndTenants = async () => {
    try {
      // 1) fetch all properties (source of truth)
      const pres = await fetch(`${API_BASE}/api/properties`);
      const plist = await pres.json();
      const propertiesList = Array.isArray(plist) ? plist : [];

      // 2) seed grouped object from PROPERTIES so even empty ones appear
      const grouped = {};
      propertiesList.forEach((p) => {
        grouped[p._id] = {
          id: p._id,
          name: p.name,
          tenants: [],
        };
      });

      // 3) fetch tenants and attach into grouped
      const tres = await fetch(`${API_BASE}/api/tenants`);
      const tenantList = await tres.json();
      const tenants = Array.isArray(tenantList) ? tenantList : [];

      tenants.forEach((tenant) => {
        const key = tenant.propertyId;

        // if tenant references a propertyId that isn't in /properties, create a fallback bucket
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            name: "Unknown Property",
            tenants: [],
          };
        }

        grouped[key].tenants.push({
          id: tenant._id,
          name: tenant.name,
          email: tenant.email,
          unit: tenant.unit,
        });
      });

      // optional: sort properties A-Z
      const finalProps = Object.values(grouped).sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );

      // optional: sort tenants by unit then name
      finalProps.forEach((p) => {
        p.tenants.sort((a, b) => {
          const ua = String(a.unit || "");
          const ub = String(b.unit || "");
          if (ua !== ub) return ua.localeCompare(ub, undefined, { numeric: true });
          return String(a.name || "").localeCompare(String(b.name || ""));
        });
      });

      setProperties(finalProps);
    } catch (err) {
      console.error("❌ Failed to fetch properties/tenants:", err);
    }
  };

  fetchDocuments();
  fetchPropertiesAndTenants();
}, [API_BASE]);

  const handlePropertySelect = (property) => {
    setSelectedProperty(property);
    setSelectedTenant(null);
    setSelectedDoc(null);
    setStatus("");
  };

  const handleTenantSelect = (tenant) => {
    setSelectedTenant(tenant);
    setSelectedDoc(null);
    setStatus("");
  };

  const handleDocumentSelect = (docType) => {
    setSelectedDoc(docType);
    setStatus("");
  };

  const handleSend = () => {
    if (!selectedTenant || !selectedDoc) return;
    setStatus(
      `📤 Sending ${selectedDoc} to ${selectedTenant.name} (${selectedTenant.email})...`
    );
    setTimeout(() => {
      setStatus("✅ Document sent to tenant and admin.");
    }, 1500);
  };

  const handleAdminClick = () => {
    setShowPasswordPrompt(true);
    setError("");
  };

  const handlePasswordSubmit = () => {
    if (adminPassword === ADMIN_SECRET) {
      navigate("/admin");
    } else {
      setError("❌ Incorrect password");
    }
  };

  const selectedDocObj = documents.find((doc) => doc.type === selectedDoc);

  return (
    <div className="container">
     <div className="header-row">
  <div className="brand">
    <img className="brand-icon" src="/docucenter.png" alt="Document Center" />
    <div>
      <h1 style={{ margin: 0 }}>Document Center</h1>
      <div className="subtle" style={{ marginTop: 4 }}>
        📄 {documents.length} documents loaded
      </div>
    </div>
  </div>

  <button className="admin-link" onClick={handleAdminClick} type="button">
    Admin Dashboard
  </button>
</div>

      <p className="subtext">🧾 {documents.length} documents loaded</p>

      {showPasswordPrompt && (
        <div className="password-modal">
          <h3>🔐 Enter Admin Password</h3>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Enter password..."
          />
          <div className="modal-buttons">
            <button onClick={handlePasswordSubmit}>Login</button>
            <button onClick={() => setShowPasswordPrompt(false)}>Cancel</button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      )}

      <h2>1. Choose Property</h2>
      <div className="button-group">
        {properties.map((property) => (
          <button key={property.id} onClick={() => handlePropertySelect(property)}>
            {property.name}
          </button>
        ))}
      </div>

     {selectedProperty.tenants.length === 0 ? (
  <p className="subtle">No tenants yet for this property.</p>
) : (
  <div className="button-group">
    {selectedProperty.tenants.map((tenant) => (
      <button key={tenant.id} onClick={() => handleTenantSelect(tenant)}>
        {tenant.name} – Unit {tenant.unit}
      </button>
    ))}
  </div>
)}

      {selectedTenant && (
        <>
          <h2>3. Choose Document</h2>
          <div className="button-group">
            {documents.map((doc) => (
              <button key={doc._id} onClick={() => handleDocumentSelect(doc.type)}>
                {doc.label}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedDoc && selectedTenant && (
        <div className="viewer">
          <h3>{selectedDoc.toUpperCase()} Document</h3>
          <p>
            <em>
              PDF for: {selectedTenant.name} (Unit {selectedTenant.unit})
            </em>
          </p>

          {selectedDocObj?.filename ? (
            <iframe
              src={`${API_BASE}/uploads/${selectedDocObj.filename}`}
              width="100%"
              height="500px"
              style={{
                border: "1px solid var(--card-border)",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.02)",
                backdropFilter: "blur(6px)",
              }}
              title="PDF Viewer"
            />
          ) : (
            <p>📁 No file available for this document.</p>
          )}

          <button className="send-button" onClick={handleSend}>
            💾 Save & Send to Tenant
          </button>
        </div>
      )}

      {status && <p className="status">{status}</p>}
    </div>
  );
}
