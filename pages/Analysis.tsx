import React, { useEffect, useState, useMemo } from 'react';
import { Search, Save, FileText, Calendar, User, ChevronLeft, ChevronRight, Menu, FileSpreadsheet } from 'lucide-react';
import { fetchData, saveNote, saveAthleteNote, getAthleteNotes } from '../services/dataService';
import { AthleteData } from '../types';
import ChartSection from '../components/ChartSection';
import MetricCard from '../components/MetricCard';
import { METRICS } from '../constants';
import { parseISO, isWithinInterval } from 'date-fns';

declare const XLSX: any;

const Analysis: React.FC = () => {
  const [rawData, setRawData] = useState<AthleteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  
  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtering State
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Notes State
  const [editingNote, setEditingNote] = useState<{id: string, date: string, text: string} | null>(null);
  const [athleteNote, setAthleteNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await fetchData();
      setRawData(data);
      // Sort data by date ascending
      data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Default selection
      if (data.length > 0) {
        setSelectedAthleteId(data[0].id);
        
        // Default Date Range: Last 6 months or full range
        const dates = data.map(d => new Date(d.date).getTime());
        const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
        const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
        setDateRange({ start: minDate, end: maxDate });
      }
      setLoading(false);
    };
    load();
  }, []);

  // Sync Athlete General Note
  useEffect(() => {
      if (selectedAthleteId) {
          const notes = getAthleteNotes();
          setAthleteNote(notes[selectedAthleteId] || '');
      }
  }, [selectedAthleteId]);

  const athletes = useMemo(() => {
    const unique = new Map();
    rawData.forEach(d => unique.set(d.id, d.name));
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [rawData]);

  const filteredAthletes = useMemo(() => {
      if (!searchTerm) return athletes;
      return athletes.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [athletes, searchTerm]);

  const filteredData = useMemo(() => {
    if (!selectedAthleteId) return [];
    
    return rawData.filter(d => {
      if (d.id !== selectedAthleteId) return false;
      if (!dateRange.start || !dateRange.end) return true;
      
      const dTime = new Date(d.date).getTime();
      const sTime = new Date(dateRange.start).getTime();
      const eTime = new Date(dateRange.end).getTime();
      
      return dTime >= sTime && dTime <= eTime;
    });
  }, [rawData, selectedAthleteId, dateRange]);

  const handleNoteSave = (record: AthleteData, text: string) => {
    saveNote(record.id, record.date, text);
    // Optimistic update
    const newData = [...rawData];
    const idx = newData.findIndex(d => d.id === record.id && d.date === record.date);
    if (idx !== -1) {
        newData[idx] = { ...newData[idx], note: text };
        setRawData(newData);
    }
    setEditingNote(null);
  };

  const handleAthleteNoteSave = () => {
      if (selectedAthleteId) {
          setIsSavingNote(true);
          saveAthleteNote(selectedAthleteId, athleteNote);
          setTimeout(() => setIsSavingNote(false), 500);
      }
  };

  const handleTableExport = () => {
    if (filteredData.length === 0) return;
    
    // Prepare export data
    const exportData = [...filteredData].reverse().map(record => {
        const row: any = { Date: record.date };
        METRICS.forEach(m => {
            row[m.label] = record[m.key];
        });
        row['Notes'] = record.note || '';
        return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Athlete Data");
    // Ensure filename is safe
    const currentName = athletes.find(a => a.id === selectedAthleteId)?.name || 'Athlete';
    const safeName = currentName.replace(/[^a-z0-9]/gi, '_');
    XLSX.writeFile(wb, `${safeName}_History.xlsx`);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Analysis...</div>;

  const currentRecord = filteredData[filteredData.length - 1];
  const previousRecord = filteredData[filteredData.length - 2];

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative">
      
      {/* Sidebar - Athlete List */}
      <div 
        className={`${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0'} absolute lg:relative z-20 h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col`}
      >
          {/* Sidebar Header */}
          <div className={`p-4 border-b border-slate-800 flex flex-col gap-3 ${!isSidebarOpen && 'hidden lg:hidden'}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-white font-bold text-lg">Athletes</h3>
                <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full font-mono">
                    {filteredAthletes.length}
                </span>
              </div>
              <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input 
                      type="text" 
                      placeholder="Search name..." 
                      className="w-full bg-slate-950/50 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all placeholder:text-slate-600"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>
          
          {/* Athlete List */}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden ${!isSidebarOpen && 'hidden lg:hidden'}`}>
              {filteredAthletes.map(athlete => (
                  <button
                      key={athlete.id}
                      onClick={() => {
                          setSelectedAthleteId(athlete.id);
                          // On mobile, maybe close sidebar after selection? 
                          // setIsSidebarOpen(false); // Optional based on UX preference
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-slate-800/30 hover:bg-slate-800/80 transition-all flex items-center gap-3 group
                          ${selectedAthleteId === athlete.id 
                              ? 'bg-slate-800 border-l-4 border-l-primary-500' 
                              : 'border-l-4 border-l-transparent'
                          }
                      `}
                  >
                      <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors
                          ${selectedAthleteId === athlete.id 
                              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
                              : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300'
                          }
                      `}>
                          <User className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <span className={`font-medium block truncate ${selectedAthleteId === athlete.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                            {athlete.name}
                        </span>
                      </div>
                  </button>
              ))}
              
              {filteredAthletes.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-sm">
                      No athletes found.
                  </div>
              )}
          </div>
      </div>

      {/* Toggle Button (Desktop & Mobile) */}
      <div className={`absolute z-30 top-4 transition-all duration-300 ${isSidebarOpen ? 'left-80' : 'left-0'}`}>
         <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             className="bg-slate-800 border border-slate-700 border-l-0 text-slate-400 hover:text-white hover:bg-slate-700 h-10 w-6 flex items-center justify-center rounded-r-lg shadow-md focus:outline-none"
             title={isSidebarOpen ? "Collapse List" : "Expand List"}
         >
             {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
         </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950/50 relative">
         <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
            
            {/* Main Header / Filters */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 pl-8 lg:pl-0">
                <div>
                     <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        {currentRecord?.name || 'Select Athlete'}
                        {currentRecord && (
                            <span className="text-xs font-normal bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700">
                                ID: {currentRecord.id}
                            </span>
                        )}
                     </h2>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 shadow-sm">
                    <Calendar className="w-4 h-4 text-primary-500" />
                    <input 
                        type="date" 
                        className="bg-transparent text-white text-sm outline-none w-32 border-none focus:ring-0 p-0"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
                    />
                    <span className="text-slate-600">-</span>
                    <input 
                        type="date" 
                        className="bg-transparent text-white text-sm outline-none w-32 border-none focus:ring-0 p-0"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
                    />
                </div>
            </div>

            {currentRecord ? (
                <>
                    {/* Performance Section */}
                    <div className="mb-10">
                        <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-primary-500 rounded-full"></span>
                            Performance Metrics
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            {METRICS.filter(m => m.category === 'performance').map(metric => (
                                <MetricCard 
                                    key={metric.key} 
                                    definition={metric} 
                                    value={currentRecord[metric.key] as number}
                                    previousValue={previousRecord ? previousRecord[metric.key] as number : undefined}
                                />
                            ))}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ChartSection 
                                title="Jump Height & Forces" 
                                data={filteredData}
                                metrics={METRICS.filter(m => ['jh', 'avgPropulsiveForce'].includes(m.key))}
                                type="mixed"
                            />
                            <ChartSection 
                                title="Propulsive RFD" 
                                data={filteredData}
                                metrics={METRICS.filter(m => ['propulsiveRfdSj'].includes(m.key))}
                            />
                        </div>
                    </div>

                    {/* Injury Prevention Section */}
                    <div className="mb-10">
                        <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-accent-500 rounded-full"></span>
                            Injury Prevention Strategy
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            {METRICS.filter(m => m.category === 'injury_prevention').map(metric => (
                                <MetricCard 
                                    key={metric.key} 
                                    definition={metric} 
                                    value={currentRecord[metric.key] as number}
                                    previousValue={previousRecord ? previousRecord[metric.key] as number : undefined}
                                />
                            ))}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ChartSection 
                                title="Efficiency (mRSI) vs Time to Takeoff" 
                                data={filteredData}
                                metrics={METRICS.filter(m => ['mrsi', 'timeToTakeoff'].includes(m.key))}
                                type="mixed"
                            />
                            <ChartSection 
                                title="Landing & Braking" 
                                data={filteredData}
                                metrics={METRICS.filter(m => ['brakingRfdCmj', 'rsiDj'].includes(m.key))}
                            />
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg mb-8">
                        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                            <h3 className="text-lg font-semibold text-white">Historical Data Log</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500 hidden sm:inline">Editable Notes (Click to edit)</span>
                                <button 
                                    onClick={handleTableExport}
                                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2 py-1.5 rounded border border-slate-700 transition-colors"
                                    title="Export Table to Excel"
                                >
                                    <FileSpreadsheet className="w-3 h-3" /> Export
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="bg-slate-950 text-slate-200 uppercase font-medium text-xs">
                                    <tr>
                                        <th className="px-4 py-3 sticky left-0 bg-slate-950 z-10 shadow-r">Date</th>
                                        {METRICS.map(m => (
                                            <th key={m.key} className="px-4 py-3 whitespace-nowrap" style={{ color: m.color }}>{m.label}</th>
                                        ))}
                                        <th className="px-4 py-3 min-w-[200px]">Coach Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {[...filteredData].reverse().map((record) => (
                                        <tr key={`${record.id}-${record.date}`} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-3 font-mono sticky left-0 bg-slate-900 z-10 border-r border-slate-800 text-slate-300 font-medium">{record.date}</td>
                                            {METRICS.map(m => (
                                                <td key={m.key} className="px-4 py-3 text-slate-300 tabular-nums">
                                                    {(record[m.key] as number).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3">
                                                {editingNote?.id === record.id && editingNote?.date === record.date ? (
                                                    <div className="flex gap-2">
                                                        <input 
                                                            autoFocus
                                                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-full text-white outline-none focus:border-primary-500 text-xs"
                                                            value={editingNote.text}
                                                            onChange={(e) => setEditingNote({...editingNote, text: e.target.value})}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleNoteSave(record, editingNote.text);
                                                                if (e.key === 'Escape') setEditingNote(null);
                                                            }}
                                                        />
                                                        <button 
                                                            onClick={() => handleNoteSave(record, editingNote.text)}
                                                            className="bg-emerald-500/20 text-emerald-500 p-1 rounded hover:bg-emerald-500/30"
                                                        >
                                                            <Save className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div 
                                                        className="cursor-pointer hover:bg-slate-800 p-1.5 -m-1.5 rounded transition-colors group min-h-[24px] flex items-center"
                                                        onClick={() => setEditingNote({ id: record.id, date: record.date, text: record.note || '' })}
                                                    >
                                                        {record.note ? (
                                                            <span className="text-slate-300 text-xs">{record.note}</span>
                                                        ) : (
                                                            <span className="text-slate-700 text-xs italic group-hover:text-slate-500">+ Add note</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Athlete General Note - Moved to Bottom */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-accent-500" /> Athlete Profile Notes
                            </h3>
                            <button 
                                onClick={handleAthleteNoteSave}
                                disabled={isSavingNote}
                                className={`text-xs px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1.5 
                                    ${isSavingNote 
                                        ? 'bg-emerald-500/20 text-emerald-500 cursor-default' 
                                        : 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/20'
                                    }`}
                            >
                                {isSavingNote ? <span className="flex items-center gap-1">Saving...</span> : <span className="flex items-center gap-1"><Save className="w-3 h-3"/> Save Note</span>}
                            </button>
                        </div>
                        <textarea 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder:text-slate-600 resize-y min-h-[80px]"
                            placeholder="Enter general observations, injury history, or training focus for this athlete..."
                            value={athleteNote}
                            onChange={(e) => setAthleteNote(e.target.value)}
                        />
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-[60vh] border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                    <User className="w-16 h-16 mb-4 text-slate-700" />
                    <p className="text-lg font-medium text-slate-400">No Athlete Selected</p>
                    <p className="text-sm mt-2">Please select an athlete from the sidebar list.</p>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Analysis;