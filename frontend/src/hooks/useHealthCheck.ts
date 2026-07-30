import { useEffect } from 'react';
import axios from 'axios';

const HEALTH_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
// Cold Render instances can take a while to wake — keep the ping patient.
const HEALTH_CHECK_URL = process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'http://localhost:5092';

export const useHealthCheck = () => {
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await axios.get(`${HEALTH_CHECK_URL}/health`, {
          timeout: 45000,
        });
      } catch (error) {
        console.warn('Backend health check failed:', error);
      }
    };

    checkHealth();
    const intervalId = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);
};

