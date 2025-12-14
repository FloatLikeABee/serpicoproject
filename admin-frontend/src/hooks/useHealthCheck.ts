import { useEffect } from 'react';
import axios from 'axios';

const HEALTH_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes in milliseconds
const HEALTH_CHECK_URL = process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'http://localhost:5092';

export const useHealthCheck = () => {
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await axios.get(`${HEALTH_CHECK_URL}/health`, {
          timeout: 5000, // 5 second timeout
        });
        // Health check successful - backend is alive
      } catch (error) {
        // Health check failed - backend might be down
        // You could add error handling/notifications here if needed
        console.warn('Backend health check failed:', error);
      }
    };

    // Initial check
    checkHealth();

    // Set up interval for periodic checks
    const intervalId = setInterval(checkHealth, HEALTH_CHECK_INTERVAL);

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, []);
};

