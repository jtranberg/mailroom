import { useState } from 'react';
import './App.css';

const properties = [
  {
    id: 'prop1',
    name: 'Sunset Villas',
    tenants: [
      { id: 't1', name: 'Jane Doe', email: 'jane@example.com', unit: '202A' },
      { id: 't2', name: 'John Smith', email: 'john@example.com', unit: '104B' },
    ],
  },
  {
    id: 'prop2',
    name: 'Maple Apartments',
    tenants: [
      { id: 't3', name: 'Alice Green', email: 'alice@maple.com', unit: '3C' },
    ],
  },
];

const documents = [
  { id: 'lease', label: 'View Lease Agreement' },
  { id: 'maintenance', label: 'Maintenance Request' },
  { id: 'inspection', label: 'Inspection Form' },
];

export default function App() {
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [status, setStatus] = useState('');

  const handleSend = () => {
    if (!selectedTenant || !selectedDoc) return;
    setStatus(`Sending ${selectedDoc} for ${selectedTenant.name} (${selectedTenant.email})...`);
    setTimeout(() => {
      setStatus('✅ Document saved and sent to admin!');
    }, 1500);
  };

  return (
    <div className="container">
      <h1>📄 Document Center</h1>

      <h2>1. Choose Property</h2>
      <div className="button-group">
        {properties.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedProperty(p);
              setSelectedTenant(null);
              setSelectedDoc(null);
              setStatus('');
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {selectedProperty && (
        <>
          <h2>2. Choose Tenant</h2>
          <div className="button-group">
            {selectedProperty.tenants.map((t) => (
              <button key={t.id} onClick={() => setSelectedTenant(t)}>
                {t.name} - Unit {t.unit}
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
              <button key={doc.id} onClick={() => setSelectedDoc(doc.id)}>
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
            <em>PDF for: {selectedTenant.name} ({selectedTenant.unit})</em>
          </p>
          <p><em>[PDF Viewer Placeholder]</em></p>
          <button className="send-button" onClick={handleSend}>
            💾 Save & Send to Admin
          </button>
        </div>
      )}

      <p className="status">{status}</p>
    </div>
  );
}
