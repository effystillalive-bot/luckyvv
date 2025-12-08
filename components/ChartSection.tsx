import React, { useRef, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { FileSpreadsheet, FileImage, Download } from 'lucide-react';
import { MetricDefinition } from '../types';

// Declare global libraries loaded via CDN
declare const XLSX: any;
declare const html2canvas: any;
declare const window: any; // for jspdf access

interface ChartSectionProps {
  title: string;
  data: any[];
  metrics: MetricDefinition[];
  type?: 'line' | 'bar' | 'mixed';
  height?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded shadow-xl text-xs">
        <p className="text-slate-300 font-bold mb-2">{label ? format(parseISO(label), 'MMM d, yyyy') : ''}</p>
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
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = () => {
    if (!data || data.length === 0) return;

    // Filter and map data to be export-friendly (focusing on displayed metrics)
    const exportData = data.map((row: any) => {
        const newRow: any = { Date: row.date };
        metrics.forEach(m => {
            if (row[m.key] !== undefined) {
                newRow[m.label] = row[m.key];
            }
        });
        return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chart Data");
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(wb, `${safeTitle}_data.xlsx`);
  };

  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    setIsExporting(true);

    try {
        // html2canvas capture
        const canvas = await html2canvas(chartRef.current, {
            backgroundColor: '#0f172a', // Ensure background matches theme
            scale: 2, // Better resolution
            logging: false,
            useCORS: true
        });

        const imgData = canvas.toDataURL('image/png');
        
        // jspdf generation
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
        
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        pdf.save(`${safeTitle}_chart.pdf`);
    } catch (err) {
        console.error("PDF Export failed:", err);
        alert("Failed to generate PDF");
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div ref={chartRef} className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 w-full relative group">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        
        {/* Export Controls - Always visible now */}
        <div className="flex gap-2" data-html2canvas-ignore>
            <button 
                onClick={handleExportExcel}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-500 hover:bg-slate-700 transition-colors"
                title="Export Data to Excel"
            >
                <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-slate-700 transition-colors disabled:opacity-50"
                title="Export Chart to PDF"
            >
                <FileImage className="w-4 h-4" />
            </button>
        </div>
      </div>

      <div style={{ width: '100%', height: height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickFormatter={(str) => format(parseISO(str), 'MM/dd')}
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