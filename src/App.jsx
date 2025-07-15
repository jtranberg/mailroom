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
        setDocuments(data);
      } catch (err) {
        console.error("❌ Failed to fetch documents:", err);
      }
    };

    const fetchTenants = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tenants`);
        const tenantList = await res.json();

        const grouped = {};
        tenantList.forEach((tenant) => {
          const key = tenant.propertyId;
          if (!grouped[key]) {
            grouped[key] = { id: key, name: key, tenants: [] };
          }
          grouped[key].tenants.push({
            id: tenant._id,
            name: tenant.name,
            email: tenant.email,
            unit: tenant.unit,
          });
        });

        setProperties(Object.values(grouped));
      } catch (err) {
        console.error("❌ Failed to fetch tenants:", err);
      }
    };

    fetchDocuments();
    fetchTenants();
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
        <h1>📄 Document Center</h1>
        <button className="admin-link" onClick={handleAdminClick}>
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

      {selectedProperty && (
        <>
          <h2>2. Choose Tenant</h2>
          <div className="button-group">
            {selectedProperty.tenants.map((tenant) => (
              <button key={tenant.id} onClick={() => handleTenantSelect(tenant)}>
                {tenant.name} – Unit {tenant.unit}
              </button>
            ))}
          </div>
        </>
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
