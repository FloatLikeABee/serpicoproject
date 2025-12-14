import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('adminUser');
    navigate('/login');
  };

  const modules = [
    { id: 'cases', name: 'Cases', icon: '📚', description: 'View all case records' },
    { id: 'perps', name: 'Perps', icon: '👤', description: 'View all perpetrator records' },
    { id: 'officers', name: 'Officers', icon: '👮', description: 'View all officer records' },
    { id: 'emergencies', name: 'Emergencies', icon: '🚨', description: 'View all emergency records' },
    { id: 'users', name: 'Users', icon: '👥', description: 'View all user accounts' },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>Serpico Admin - Backstage</h1>
            <p>Manage and view all backend data modules</p>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="modules-grid">
          {modules.map((module) => (
            <div
              key={module.id}
              className="module-card"
              onClick={() => navigate(`/data/${module.id}`)}
            >
              <div className="module-icon">{module.icon}</div>
              <h2>{module.name}</h2>
              <p>{module.description}</p>
            </div>
          ))}
        </div>

        <div className="special-module">
          <div
            className="module-card special"
            onClick={() => navigate('/rag-training')}
          >
            <div className="module-icon">🤖</div>
            <h2>RAG Data Training</h2>
            <p>Format and input RAG data for AI training</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

