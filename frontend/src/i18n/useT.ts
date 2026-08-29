import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { t } from './catalog';
import { parseNation } from '../utils/nation';

export function useT() {
  const { user } = useAuth();
  const nation = parseNation(user?.nation);
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => t(nation, key, vars),
    [nation]
  );
}

export function useNation() {
  const { user } = useAuth();
  return parseNation(user?.nation);
}
