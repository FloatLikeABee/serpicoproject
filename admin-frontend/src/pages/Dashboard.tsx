import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

type Module = {
  id: string;
  name: string;
  description: string;
  special?: boolean;
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('adminUser');
    navigate('/login');
  };

  const modules: Module[] = [
    { id: 'cases', name: 'Cases', description: 'Open and closed case records' },
    { id: 'perps', name: 'Suspects', description: 'Suspect and fugitive records' },
    { id: 'officers', name: 'Officers', description: 'Officer roster and status' },
    { id: 'emergencies', name: 'Emergencies', description: 'Active and past emergency calls' },
    { id: 'users', name: 'Users', description: 'App user accounts' },
    { id: 'data-collection', name: 'Data Collection', description: 'Ingest from web, APIs, or files', special: true },
    { id: 'rag-training', name: 'RAG Training', description: 'AI training documents', special: true },
  ];

  const openModule = (module: Module) => {
    if (module.id === 'rag-training') navigate('/rag-training');
    else if (module.id === 'data-collection') navigate('/data-collection');
    else navigate(`/data/${module.id}`);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>Serpico Admin</h1>
            <p>Backend data and AI training</p>
          </div>
          <button type="button" onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="modules-grid">
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={`module-card ${module.special ? 'special' : ''}`}
              onClick={() => openModule(module)}
            >
              <h2>{module.name}</h2>
              <p>{module.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
