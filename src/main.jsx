// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import AdminDashboard from './AdminDashboard'; // ⬅️ import the component
import "./App.css"; //
import PropertyUnits from "./PropertyUnits";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminDashboard />} /> {/* ⬅️ Route works now */}
        <Route path="/properties/:id" element={<PropertyUnits />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
