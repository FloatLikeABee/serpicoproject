import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { useHealthCheck } from './hooks/useHealthCheck';
import Login from './pages/Login';
import HardDataDocs from './pages/HardDataDocs';
import HardDataHandle from './pages/HardDataHandle';
import Dashboard from './pages/Dashboard';
import HomeGate from './pages/HomeGate';
import Join from './pages/Join';
import FridgeRaid from './pages/FridgeRaid';
import Lalem from './pages/Lalem';
import Shuileme from './pages/Shuileme';
import Xiaomaomi from './pages/Xiaomaomi';
import Travel from './pages/Travel';
import AgentSkill from './pages/AgentSkill';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function AppContent() {
  useHealthCheck(); // Start health check polling

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeGate />} />
        <Route path="/join" element={<Join />} />
        <Route path="/login" element={<Login />} />
        <Route path="/x-hard-data/hw/:serial" element={<HardDataHandle />} />
        <Route path="/x-hard-data" element={<HardDataDocs />} />
        <Route path="/fridge-raid" element={<FridgeRaid />} />
        <Route path="/lalem" element={<Lalem />} />
        <Route path="/shuileme/chat" element={<Shuileme />} />
        <Route path="/shuileme" element={<Shuileme />} />
        <Route path="/xiaomaomi" element={<Xiaomaomi />} />
        <Route path="/travel" element={<Travel />} />
        <Route path="/agent-skill" element={<AgentSkill />} />
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

