import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { MetricDefinition } from '../types';

interface MetricCardProps {
  definition: MetricDefinition;
  value: number;
  previousValue?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ definition, value, previousValue }) => {
  let change = 0;
  let TrendIcon = Minus;
  let trendColor = 'text-slate-400';

  if (previousValue !== undefined && previousValue !== 0) {
    change = ((value - previousValue) / previousValue) * 100;
    if (change > 0.5) {
      TrendIcon = ArrowUpRight;
      trendColor = 'text-emerald-500';
    } else if (change < -0.5) {
      TrendIcon = ArrowDownRight;
      trendColor = 'text-rose-500';
    }
  }

  return (
    <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 hover:border-slate-700 transition-colors shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-slate-400">{definition.label}</h3>
        <div className="p-1.5 rounded bg-slate-800/50" style={{ color: definition.color }}>
          {/* Simple circle or icon based on category */}
          <div className="w-2 h-2 rounded-full bg-current"></div>
        </div>
      </div>
      
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-bold text-white">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        <span className="text-sm text-slate-500">{definition.unit}</span>
      </div>

      {previousValue !== undefined && (
        <div className={`flex items-center mt-3 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="w-3 h-3 mr-1" />
          <span>{Math.abs(change).toFixed(1)}%</span>
          <span className="ml-1 text-slate-600 font-normal">vs prev</span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
