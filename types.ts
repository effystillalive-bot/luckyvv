export interface AthleteData {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  // Performance Metrics
  jh: number; // Jump Height (cm)
  avgPropulsiveForce: number; // N
  peakPropulsiveForce: number; // N
  peakPropulsivePower: number; // W
  propulsiveRfdSj: number; // N/s
  
  // Injury Prevention / Strategy Metrics
  mrsi: number; // Modified RSI
  timeToTakeoff: number; // s
  brakingRfdCmj: number; // N/s
  rsiDj: number; // RSI Drop Jump
  lrPeakBrakingForceDiff: number; // %
  
  // Metadata
  note?: string; // Daily note from CSV or local override
}

export interface MetricDefinition {
  key: keyof AthleteData;
  label: string;
  unit: string;
  category: 'performance' | 'injury_prevention' | 'general';
  color: string;
  description?: string;
}

export type TimeRange = '1m' | '3m' | '6m' | '1y' | 'all' | 'custom';

export interface DateRange {
  start: string;
  end: string;
}
