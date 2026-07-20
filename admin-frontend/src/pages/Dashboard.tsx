import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

type Module = {
  id: string;
  name: string;
  description: string;
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('adminUser');
    navigate('/login');
  };

  const modules: Module[] = [
    { id: 'users', name: 'Users', description: 'App user accounts' },
    { id: 'data-collection', name: 'Data Collection', description: 'Ingest from web, APIs, or files' },
    { id: 'rag-training', name: 'RAG Training', description: 'AI training documents' },
  ];

  const openModule = (module: Module) => {
    if (module.id === 'rag-training') navigate('/rag-training');
    else if (module.id === 'data-collection') navigate('/data-collection');
    else navigate(`/data/${module.id}`);
  };

  return (
    <div className="admin-page dashboard">
      <header className="admin-header-bar dashboard-header">
        <div className="header-content">
          <div>
            <p className="eyebrow">Serpico</p>
            <h1 className="neon-title">Admin</h1>
            <p className="muted">Users, collection, and RAG</p>
          </div>
          <button type="button" onClick={handleLogout} className="btn btn-ghost">
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
              className="module-card admin-panel"
              onClick={() => openModule(module)}
            >
              <h2>{module.name}</h2>
              <p className="muted">{module.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
