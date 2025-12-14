import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useHealthCheck } from './hooks/useHealthCheck';
import Dashboard from './pages/Dashboard';
import DataViewer from './pages/DataViewer';
import RAGTraining from './pages/RAGTraining';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function AppContent() {
  useHealthCheck(); // Start health check polling

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/data/:module"
        element={
          <ProtectedRoute>
            <DataViewer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rag-training"
        element={
          <ProtectedRoute>
            <RAGTraining />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

