import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [type, setType] = useState('');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [newProperty, setNewProperty] = useState('');
  const [tenantForm, setTenantForm] = useState({
    name: '',
    email: '',
    unit: '',
    property: ''
  });

  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tenants`);
        const data = await res.json();
        if (res.ok) setTenants(data);
      } catch (err) {
        setStatus(`❌ Failed to load tenants: ${err.message}`);
      }
    };

    const fetchProperties = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/properties`);
        const data = await res.json();
        if (res.ok) setProperties(data);
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
      setStatus('❌ Please fill out all fields');
      return;
    }

    const formData = new FormData();
    formData.append('type', type);
    formData.append('label', label);
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/documents`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setStatus(`✅ Uploaded: ${data.document.label}`);
        setType('');
        setLabel('');
        setFile(null);
      } else {
        setStatus(`❌ Upload failed: ${data.error}`);
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  const handleTenantSubmit = async (e) => {
    e.preventDefault();
    const { name, email, unit, property } = tenantForm;

    if (!name || !email || !unit || !property) {
      setStatus('❌ Please fill out all tenant fields');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          unit,
          propertyId: property
        })
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(`✅ Tenant ${data.tenant.name} added.`);
        setTenantForm({ name: '', email: '', unit: '', property: '' });
        setTenants((prev) => [...prev, data.tenant]);
      } else {
        setStatus(`❌ Add failed: ${data.error}`);
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  const handleAddProperty = async (e) => {
    e.preventDefault();
    if (!newProperty.trim()) return setStatus('❌ Property name is required');

    try {
      const res = await fetch(`${API_BASE}/api/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProperty.trim() })
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(`✅ Property "${data.property.name}" added`);
        setProperties((prev) => [...prev, data.property]);
        setNewProperty('');
      } else {
        setStatus(`❌ Add failed: ${data.error}`);
      }
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="container">
      <div className="admin-header">
        <h2>🛠️ Admin Dashboard</h2>
        <button className="back-button" onClick={() => navigate('/')}>
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
          onChange={(e) => setFile(e.target.files[0])}
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
        <h3>Add New Tenant</h3>
        <input
          type="text"
          placeholder="Name"
          value={tenantForm.name}
          onChange={(e) =>
            setTenantForm({ ...tenantForm, name: e.target.value })
          }
        />
        <input
          type="email"
          placeholder="Email"
          value={tenantForm.email}
          onChange={(e) =>
            setTenantForm({ ...tenantForm, email: e.target.value })
          }
        />
        <input
          type="text"
          placeholder="Unit #"
          value={tenantForm.unit}
          onChange={(e) =>
            setTenantForm({ ...tenantForm, unit: e.target.value })
          }
        />
        <select
          value={tenantForm.property}
          onChange={(e) =>
            setTenantForm({ ...tenantForm, property: e.target.value })
          }
        >
          <option value="">Select Property</option>
          {properties.map((p) => (
            <option key={p._id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="submit">➕ Add Tenant</button>
      </form>

      {tenants.length > 0 && (
        <div className="tenant-list">
          <h4>🧑‍💼 Tenants:</h4>
          <ul>
            {tenants.map((t) => (
              <li key={t._id}>
                {t.name} ({t.unit}) — {t.propertyId}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status && <p className="status">{status}</p>}
    </div>
  );
}
