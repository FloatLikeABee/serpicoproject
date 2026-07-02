import React, { useMemo } from 'react';
import MapCanvas from '../../components/MapCanvas';

const OLATHE_CENTER: [number, number] = [38.8814, -94.8191];

const POLICE_UNITS = [
  { title: 'Unit 12 — Lead Pursuit', description: 'OPD-1247 • S Kansas Ave • Code 3 active' },
  { title: 'Unit 45 — Cover', description: 'OPD-3301 • Parallel on Ridgeview Rd' },
  { title: 'Unit 08 — Perimeter', description: 'OPD-0892 • Blocking E Santa Fe exit' },
  { title: 'Unit 22 — Air Support', description: 'Helo-2 • Visual on suspect vehicle' },
  { title: 'Unit 31 — K-9 Staging', description: 'OPD-5510 • En route to foot bail-out zone' },
  { title: 'Unit 17 — Traffic', description: 'OPD-7712 • Clearing intersection at 127th' },
];

const SUSPECT_VEHICLES = [
  { title: 'Suspect — Stolen Sedan', description: 'Silver Honda Civic • Plate KNG-452 • Fleeing eastbound' },
  { title: 'Suspect — Pickup', description: 'Black Ford F-150 • Possible armed • Highway merge' },
  { title: 'Suspect — SUV', description: 'White Tahoe • Aggressive driving • Residential zone' },
  { title: 'Suspect — Motorcycle', description: 'Dark sport bike • Last seen N Ridgeview' },
  { title: 'Suspect — Van', description: 'Gray panel van • Burglary tie-in • Slow rolling' },
  { title: 'Suspect — Compact', description: 'Red Corolla • Hit-and-run link • Weaving traffic' },
  { title: 'Suspect — Work Truck', description: 'Blue work truck • No plates • South Olathe' },
  { title: 'Suspect — Crossover', description: 'Green RAV4 • BOLO active • Parking lot flee' },
];

function randomOlathePosition(): [number, number] {
  const latSpread = 0.06;
  const lngSpread = 0.07;
  return [
    OLATHE_CENTER[0] + (Math.random() - 0.5) * latSpread,
    OLATHE_CENTER[1] + (Math.random() - 0.5) * lngSpread,
  ];
}

function generatePursuitMarkers() {
  const policeCount = 4 + Math.floor(Math.random() * 3); // 4–6
  const suspectCount = 5 + Math.floor(Math.random() * 4); // 5–8

  const shuffledPolice = [...POLICE_UNITS].sort(() => Math.random() - 0.5).slice(0, policeCount);
  const shuffledSuspects = [...SUSPECT_VEHICLES].sort(() => Math.random() - 0.5).slice(0, suspectCount);

  const policeMarkers = shuffledPolice.map((unit, index) => ({
    id: `police-${index + 1}`,
    position: randomOlathePosition(),
    type: 'police-vehicle' as const,
    title: unit.title,
    description: unit.description,
  }));

  const suspectMarkers = shuffledSuspects.map((unit, index) => ({
    id: `suspect-${index + 1}`,
    position: randomOlathePosition(),
    type: 'suspect-vehicle' as const,
    title: unit.title,
    description: unit.description,
  }));

  return [...policeMarkers, ...suspectMarkers];
}

const InPursue: React.FC = () => {
  const pursuits = useMemo(() => generatePursuitMarkers(), []);
  const policeCount = pursuits.filter((m) => m.type === 'police-vehicle').length;
  const suspectCount = pursuits.filter((m) => m.type === 'suspect-vehicle').length;

  return (
    <div className="page-fill">
      <div className="game-header p-2 sm:p-3">
        <h1 className="text-lg sm:text-xl font-display font-bold text-serpico-red dark:text-serpico-red-light tracking-wide">Pursue</h1>
        <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 mt-0.5 font-mono uppercase tracking-wider truncate">
          <span className="text-neon-green/70">{'/// '}</span>
          Olathe pursuit grid
        </p>
      </div>
      
      <div className="flex-1 min-h-0 relative">
        <MapCanvas
          center={OLATHE_CENTER}
          zoom={13}
          markers={pursuits}
        />
      </div>

      <div className="game-header border-t border-neon-purple/20 p-2 sm:p-3">
        <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="inline-block w-2 h-2 rounded-full bg-serpico-blue flex-shrink-0" aria-hidden />
            <span className="font-medium dark:text-gray-300 truncate">Police</span>
            <span className="text-serpico-blue font-bold">{policeCount}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="inline-block w-2 h-2 rounded-full bg-serpico-red flex-shrink-0" aria-hidden />
            <span className="font-medium dark:text-gray-300 truncate">Suspects</span>
            <span className="text-serpico-red font-bold">{suspectCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InPursue;
