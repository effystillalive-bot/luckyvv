import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { MetricDefinition } from '../types';

interface ChartSectionProps {
  title: string;
  data: any[];
  metrics: MetricDefinition[];
  type?: 'line' | 'bar' | 'mixed';
  height?: number;
}

// Helper to format date string YYYY-MM-DD to MMM d, yyyy
const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return dateStr;
};

// Helper to format date string YYYY-MM-DD to MM/dd
const formatDateAxis = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-xl text-xs">
        <p className="text-slate-300 font-bold mb-2">{label ? formatDateLabel(label) : ''}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400">{entry.name}:</span>
            <span className="text-white font-mono font-medium">
                {entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                {entry.payload.unit}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const ChartSection: React.FC<ChartSectionProps> = ({ title, data, metrics, type = 'line', height = 300 }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 w-full relative group">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>

      <div style={{ width: '100%', height: height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDateAxis}
              stroke="#64748b"
              tick={{ fontSize: 12 }}
              tickMargin={10}
            />
            <YAxis 
              stroke="#64748b"
              tick={{ fontSize: 12 }}
              tickMargin={10}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            {metrics.map((metric, index) => {
                if (type === 'bar' || (type === 'mixed' && index % 2 !== 0)) {
                    return (
                        <Bar
                            key={metric.key}
                            dataKey={metric.key}
                            name={metric.label}
                            fill={metric.color}
                            radius={[4, 4, 0, 0]}
                            barSize={20}
                        />
                    )
                }
                return (
                    <Line
                        key={metric.key}
                        type="monotone"
                        dataKey={metric.key}
                        name={metric.label}
                        stroke={metric.color}
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#0f172a', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                    />
                )
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartSection;