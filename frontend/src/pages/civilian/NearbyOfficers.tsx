import React, { useState } from 'react';
import MapCanvas from '../../components/MapCanvas';
import AIChatPanel from '../../components/AIChatPanel';
import { useTheme } from '../../contexts/ThemeContext';

const NearbyOfficers: React.FC = () => {
  const { theme } = useTheme();
  const [officers] = useState([
    {
      id: '1',
      position: [38.8814, -94.8191] as [number, number], // [lat, lng] - Olathe
      type: 'officer' as const,
      title: 'Officer Smith - Olathe PD',
      description: 'Rank: Sergeant • Vehicle: OPD-1234',
    },
    {
      id: '2',
      position: [38.8914, -94.8091] as [number, number], // [lat, lng] - North Olathe
      type: 'officer' as const,
      title: 'Officer Johnson - Olathe PD',
      description: 'Rank: Officer • Vehicle: OPD-5678',
    },
    {
      id: '3',
      position: [38.8714, -94.8291] as [number, number], // [lat, lng] - South Olathe
      type: 'danger' as const,
      title: 'Active Pursuit',
      description: 'Vehicle pursuit in progress - Olathe PD',
    },
  ]);

  return (
    <div className="h-full flex flex-col">
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-2xl font-bold text-serpico-blue dark:text-serpico-blue-light">Nearby Officers</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Police vehicles and possible dangers</p>
      </div>
      
      <div className="flex-1 relative">
        <MapCanvas
          center={[38.8814, -94.8191]} // [lat, lng] - Olathe, Kansas
          zoom={13}
          markers={officers}
        />
        <AIChatPanel context="nearby-officers" />
      </div>

      <div className={`p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium dark:text-gray-300">Nearby Officers</span>
            <span className="text-sm text-serpico-blue dark:text-serpico-blue-light font-bold">2</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium dark:text-gray-300">Active Dangers</span>
            <span className="text-sm text-serpico-red dark:text-serpico-red-light font-bold">1</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
          💬 Open AI Chat drawer to see detailed officer information
        </p>
      </div>
    </div>
  );
};

export default NearbyOfficers;

