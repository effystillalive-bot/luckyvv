import { MetricDefinition } from './types';

export const METRICS: MetricDefinition[] = [
  // Performance
  { key: 'jh', label: 'Jump Height (JH)', unit: 'cm', category: 'performance', color: '#0ea5e9' },
  { key: 'avgPropulsiveForce', label: 'Avg Propulsive Force', unit: 'N', category: 'performance', color: '#3b82f6' },
  { key: 'peakPropulsiveForce', label: 'Peak Propulsive Force', unit: 'N', category: 'performance', color: '#60a5fa' },
  { key: 'peakPropulsivePower', label: 'Peak Propulsive Power', unit: 'W', category: 'performance', color: '#93c5fd' },
  { key: 'propulsiveRfdSj', label: 'Propulsive RFD (SJ)', unit: 'N/s', category: 'performance', color: '#2563eb' },

  // Injury Prevention / Strategy
  { key: 'mrsi', label: 'mRSI', unit: '', category: 'injury_prevention', color: '#f97316', description: 'Explosive efficiency value' },
  { key: 'timeToTakeoff', label: 'Time To Takeoff', unit: 's', category: 'injury_prevention', color: '#fb923c' },
  { key: 'brakingRfdCmj', label: 'Braking RFD (CMJ)', unit: 'N/s', category: 'injury_prevention', color: '#fdba74' },
  { key: 'rsiDj', label: 'RSI (DJ)', unit: '', category: 'injury_prevention', color: '#ea580c' },
  { key: 'lrPeakBrakingForceDiff', label: 'L/R Asymmetry', unit: '%', category: 'injury_prevention', color: '#ef4444' },
];

export const MOCK_DATA_CSV = `
Date,Name,JH,Avg Propulsive Force,mRSI,Time To Takeoff,Propulsive RFD (SJ),Braking RFD (CMJ),RSI (DJ),Peak Propulsive Power,L/R Peak Braking Asym
2025-06-30,Demo Athlete A,37,1826,0.65,0.65,5919,8367,1.53,2526,0.71
2025-07-24,Demo Athlete A,35,1732,0.49,0.71,6166,7367,1.93,2600,-0.69
2025-08-24,Demo Athlete A,33,1759,0.47,0.72,7650,7681,1.65,2450,0.4
2025-08-28,Demo Athlete A,35,1742,0.50,0.70,7800,6612,1.70,2500,-1.52
2025-09-11,Demo Athlete A,37,1792,0.52,0.72,3514,6335,1.75,2526,0.31
2025-09-26,Demo Athlete A,37,1759,0.51,0.72,3600,7675,1.80,2550,0.42
2025-09-27,Demo Athlete A,38,1791,0.54,0.69,3700,7553,1.85,2580,0.58
2025-06-30,Demo Athlete B,40,1878,0.65,0.61,8207,10508,1.90,2800,2.1
2025-07-24,Demo Athlete B,40,1964,0.70,0.57,8086,9805,2.31,2900,1.5
2025-08-24,Demo Athlete B,38,1842,0.60,0.63,10790,9359,1.92,2750,1.8
`;
