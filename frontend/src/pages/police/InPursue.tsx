import React, { useState } from 'react';
import MapCanvas from '../../components/MapCanvas';
import AIChatPanel from '../../components/AIChatPanel';
import { useTheme } from '../../contexts/ThemeContext';

const InPursue: React.FC = () => {
  const { theme } = useTheme();
  const [pursuits] = useState([
    {
      id: '1',
      position: [38.8814, -94.8191] as [number, number], // [lat, lng] - Olathe
      type: 'case' as const,
      title: 'Active Pursuit #1234',
      description: 'Vehicle pursuit in progress - Olathe PD',
    },
    {
      id: '2',
      position: [38.8914, -94.8091] as [number, number], // [lat, lng] - North Olathe
      type: 'perp' as const,
      title: 'Suspect Location',
      description: 'Last known location in Olathe',
    },
    {
      id: '3',
      position: [38.8714, -94.8291] as [number, number], // [lat, lng] - South Olathe
      type: 'perp' as const,
      title: 'Subject Alpha',
      description: 'Nearby possible perp - Active status',
    },
    {
      id: '4',
      position: [38.9014, -94.7991] as [number, number], // [lat, lng] - North Olathe
      type: 'perp' as const,
      title: 'Subject Delta',
      description: 'Nearby possible perp - Last seen recently',
    },
  ]);

  return (
    <div className="h-full flex flex-col">
      <div className={`p-4 border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h1 className="text-2xl font-bold text-serpico-red dark:text-serpico-red-light">Pursue</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Active cases, pursuits, and nearby perps</p>
      </div>
      
      <div className="flex-1 relative">
        <MapCanvas
          center={[38.8814, -94.8191]} // [lat, lng] - Olathe, Kansas
          zoom={13}
          markers={pursuits}
        />
        <AIChatPanel context="in-pursue" />
      </div>

      <div className={`p-4 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium dark:text-gray-300">Active Pursuits</span>
            <span className="text-sm text-serpico-red dark:text-serpico-red-light font-bold">2</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium dark:text-gray-300">Nearby Possible Perps</span>
            <span className="text-sm text-serpico-red dark:text-serpico-red-light font-bold">3</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InPursue;

