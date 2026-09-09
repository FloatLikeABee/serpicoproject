import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Dashboard from './Dashboard';
import Landing from './Landing';

const HomeGate: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Dashboard /> : <Landing />;
};

export default HomeGate;
