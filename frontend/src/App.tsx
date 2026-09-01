import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { useHealthCheck } from './hooks/useHealthCheck';
import Login from './pages/Login';
import HardDataDocs from './pages/HardDataDocs';
import HardDataHandle from './pages/HardDataHandle';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function AppContent() {
  useHealthCheck(); // Start health check polling

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/x-hard-data/hw/:serial" element={<HardDataHandle />} />
        <Route path="/x-hard-data" element={<HardDataDocs />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

