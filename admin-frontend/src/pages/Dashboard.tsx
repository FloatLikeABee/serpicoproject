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
    { id: 'cases', name: 'Serial Killer Cases', icon: '🔪', description: 'View all serial killer case records' },
    { id: 'perps', name: 'Serial Killers', icon: '👤', description: 'View all serial killer records' },
    { id: 'mysteries', name: 'Mysteries', icon: '🔍', description: 'View paranormal, urban legends & conspiracy theories' },
    { id: 'officers', name: 'Officers', icon: '👮', description: 'View all officer records' },
    { id: 'emergencies', name: 'Emergencies', icon: '🚨', description: 'View all emergency records' },
    { id: 'users', name: 'Users', icon: '👥', description: 'View all user accounts' },
    { id: 'data-collection', name: 'Data Collection', icon: '📥', description: 'Collect data from web, APIs, or files', special: true },
    { id: 'rag-training', name: 'RAG Data Training', icon: '🤖', description: 'Format and input RAG data for AI training', special: true },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>Serpico Admin - Backstage</h1>
            <p>Manage serial killers, mysteries, paranormal events & conspiracy theories</p>
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
              className={`module-card ${module.special ? 'special' : ''}`}
              onClick={() => {
                if (module.id === 'rag-training') navigate('/rag-training');
                else if (module.id === 'data-collection') navigate('/data-collection');
                else navigate(`/data/${module.id}`);
              }}
            >
              <div className="module-icon">{module.icon}</div>
              <h2>{module.name}</h2>
              <p>{module.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

