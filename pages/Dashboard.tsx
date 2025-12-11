import React, { useEffect, useState, useMemo } from 'react';
import { Users, TrendingUp, AlertTriangle, ArrowRight, RefreshCw, BarChart2, CheckSquare, Square, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fetchData } from '../services/dataService';
import { AthleteData } from '../types';
import ChartSection from '../components/ChartSection';
import { METRICS } from '../constants';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<AthleteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  
  // Comparison State
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [comparisonMetric, setComparisonMetric] = useState<keyof AthleteData>('jh');

  const loadDashboardData = async () => {
      setSyncing(true);
      const fetchedData = await fetchData();
      
      // Sort data chronologically
      fetchedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setData(fetchedData);
      setLastSynced(new Date());
      setLoading(false);
      setSyncing(false);
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
        loadDashboardData();
    }, 300000); // 5 mins
    return () => clearInterval(interval);
  }, []);

  // Set default selection (Top 5 by JH) once data is loaded
  useEffect(() => {
      if (!loading && data.length > 0 && selectedAthletes.length === 0) {
          const latest = getLatestRecords();
          const top5 = latest.slice(0, 5).map(a => a.id);
          setSelectedAthletes(top5);
      }
  }, [loading, data]);

  // Process data to find the latest record for each athlete
  const getLatestRecords = () => {
    const latestMap = new Map<string, AthleteData>();
    data.forEach(record => {
        const existing = latestMap.get(record.id);
        if (!existing || new Date(record.date) > new Date(existing.date)) {
            latestMap.set(record.id, record);
        }
    });
    return Array.from(latestMap.values()).sort((a, b) => b.jh - a.jh);
  };

  const latestRecords = useMemo(() => getLatestRecords(), [data]);

  // --- Comparison Logic ---

  const availableAthletes = useMemo(() => {
      return latestRecords
          .filter(a => a.name.toLowerCase().includes(athleteSearch.toLowerCase()))
          .map(a => ({ id: a.id, name: a.name }));
  }, [latestRecords, athleteSearch]);

  const toggleAthleteSelection = (id: string) => {
      setSelectedAthletes(prev => {
          if (prev.includes(id)) return prev.filter(x => x !== id);
          if (prev.length >= 10) return prev; // Limit to 10 for chart readability
          return [...prev, id];
      });
  };

  // Prepare Trend Data (Pivot: Date -> { Athlete1: Val, Athlete2: Val })
  const comparisonTrendData = useMemo(() => {
      const dateMap = new Map<string, any>();
      
      // Filter raw data to only selected athletes
      const relevantData = data.filter(d => selectedAthletes.includes(d.id));
      
      relevantData.forEach(d => {
          if (!dateMap.has(d.date)) {
              dateMap.set(d.date, { date: d.date });
          }
          const entry = dateMap.get(d.date);
          entry[d.id] = d[comparisonMetric];
      });

      return Array.from(dateMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, selectedAthletes, comparisonMetric]);

  // Prepare Snapshot Data (Latest values for selected athletes)
  const comparisonSnapshotData = useMemo(() => {
      return latestRecords.filter(r => selectedAthletes.includes(r.id));
  }, [latestRecords, selectedAthletes]);

  // Color palette for lines
  const COLORS = ['#0ea5e9', '#f97316', '#22c55e', '#a855f7', '#eab308', '#ec4899', '#64748b', '#ef4444', '#14b8a6', '#6366f1'];


  if (loading) return <div className="p-10 text-center text-slate-500">Loading Dashboard...</div>;

  // Aggregate stats
  const totalAthletes = latestRecords.length;
  const avgTeamRSI = latestRecords.reduce((acc, curr) => acc + curr.mrsi, 0) / (totalAthletes || 1);
  const avgTeamJH = latestRecords.reduce((acc, curr) => acc + curr.jh, 0) / (totalAthletes || 1);

  // Team Trend Data (Average JH)
  const groupedByDate: Record<string, { date: string; avgJh: number; count: number }> = {};
  data.forEach(d => {
    if (!groupedByDate[d.date]) {
      groupedByDate[d.date] = { date: d.date, avgJh: 0, count: 0 };
    }
    groupedByDate[d.date].avgJh += d.jh;
    groupedByDate[d.date].count += 1;
  });
  const teamTrendData = Object.values(groupedByDate)
    .map(d => ({ date: d.date, jh: d.avgJh / d.count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-white">Team Overview</h1>
            <p className="text-slate-400 text-sm">Aggregated performance data for all athletes.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
             <div className="flex items-center text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
                System Status: Online
             </div>
             <div className="flex flex-col items-end">
                <button 
                    onClick={() => loadDashboardData()}
                    disabled={syncing}
                    className="flex items-center text-xs text-primary-400 hover:text-primary-300 transition-colors bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Manual Sync'}
                </button>
                <span className="text-[10px] text-slate-600 mt-1 mr-1">
                    Last: {lastSynced.toLocaleTimeString()}
                </span>
             </div>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center shadow-lg">
            <div className="p-3 bg-primary-500/20 rounded-lg text-primary-500">
                <Users className="w-8 h-8" />
            </div>
            <div className="ml-4">
                <p className="text-sm text-slate-400">Active Athletes</p>
                <p className="text-3xl font-bold text-white">{totalAthletes}</p>
            </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center shadow-lg">
            <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-500">
                <TrendingUp className="w-8 h-8" />
            </div>
            <div className="ml-4">
                <p className="text-sm text-slate-400">Avg Jump Height</p>
                <p className="text-3xl font-bold text-white">
                    {avgTeamJH.toFixed(1)}
                    <span className="text-sm font-normal text-slate-500 ml-1">cm</span>
                </p>
            </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center shadow-lg">
            <div className="p-3 bg-accent-500/20 rounded-lg text-accent-500">
                <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="ml-4">
                <p className="text-sm text-slate-400">Avg mRSI</p>
                <p className="text-3xl font-bold text-white">{avgTeamRSI.toFixed(2)}</p>
            </div>
        </div>
      </div>

      {/* Team Trend Chart (Collapsible or Standard) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <ChartSection 
                title="Team Average Trend (JH)" 
                data={teamTrendData} 
                metrics={[METRICS.find(m => m.key === 'jh')!]} 
                height={300}
            />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Analysis</h3>
            <div className="space-y-3">
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Top Performer (JH)</p>
                    <p className="text-white font-medium">{latestRecords[0]?.name || '-'}</p>
                    <p className="text-emerald-500 text-sm">{latestRecords[0]?.jh} cm</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                     <p className="text-xs text-slate-400 uppercase font-bold mb-1">Highest mRSI</p>
                     <p className="text-white font-medium">
                         {latestRecords.slice().sort((a,b) => b.mrsi - a.mrsi)[0]?.name || '-'}
                     </p>
                     <p className="text-accent-500 text-sm">
                         {latestRecords.slice().sort((a,b) => b.mrsi - a.mrsi)[0]?.mrsi}
                     </p>
                </div>
            </div>
        </div>
      </div>

      {/* --- COMPARISON MODULE --- */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-primary-500" />
                      Athlete Comparison
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Select athletes to compare detailed metrics over time.</p>
              </div>
              
              {/* Metric Selector for Trend Chart */}
              <div className="flex items-center gap-3 bg-slate-950 rounded-lg p-1 border border-slate-700">
                  <span className="text-xs text-slate-500 font-medium pl-2 uppercase">Metric:</span>
                  <select 
                      className="bg-slate-900 text-white text-sm border-none focus:ring-0 rounded-md py-1 px-2 outline-none cursor-pointer"
                      value={comparisonMetric}
                      onChange={(e) => setComparisonMetric(e.target.value as keyof AthleteData)}
                  >
                      {METRICS.map(m => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                  </select>
              </div>
          </div>

          <div className="flex flex-col lg:flex-row h-[600px] lg:h-[500px]">
              
              {/* Left Sidebar: Selector */}
              <div className="w-full lg:w-64 bg-slate-900/50 border-r border-slate-800 flex flex-col">
                  <div className="p-3 border-b border-slate-800">
                      <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                          <input 
                              type="text" 
                              placeholder="Search athletes..." 
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:border-primary-500 outline-none"
                              value={athleteSearch}
                              onChange={(e) => setAthleteSearch(e.target.value)}
                          />
                      </div>
                      <div className="flex justify-between items-center mt-2 px-1">
                          <span className="text-xs text-slate-500">{selectedAthletes.length} selected</span>
                          <button 
                             onClick={() => setSelectedAthletes([])}
                             className="text-xs text-rose-500 hover:text-rose-400"
                          >
                             Clear
                          </button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                      {availableAthletes.map(a => {
                          const isSelected = selectedAthletes.includes(a.id);
                          return (
                              <div 
                                  key={a.id}
                                  onClick={() => toggleAthleteSelection(a.id)}
                                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-primary-900/20 border border-primary-500/30' : 'hover:bg-slate-800 border border-transparent'}`}
                              >
                                  {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-primary-500 shrink-0" />
                                  ) : (
                                      <Square className="w-4 h-4 text-slate-600 shrink-0" />
                                  )}
                                  <span className={`text-sm truncate ${isSelected ? 'text-primary-100 font-medium' : 'text-slate-400'}`}>
                                      {a.name}
                                  </span>
                              </div>
                          )
                      })}
                      {availableAthletes.length === 0 && (
                          <div className="p-4 text-center text-xs text-slate-500">No matches found</div>
                      )}
                  </div>
              </div>

              {/* Right Content: Charts */}
              <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-950">
                  {selectedAthletes.length > 0 ? (
                      <div className="grid grid-cols-1 gap-8">
                          
                          {/* 1. Comparison Trend Line Chart */}
                          <div className="h-[250px] w-full">
                              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
                                  <TrendingUp className="w-4 h-4 mr-2 text-emerald-500" />
                                  Historical Trend: {METRICS.find(m => m.key === comparisonMetric)?.label}
                              </h3>
                              <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={comparisonTrendData}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                      <XAxis 
                                          dataKey="date" 
                                          tickFormatter={(str) => format(parseISO(str), 'MM/dd')}
                                          stroke="#64748b"
                                          tick={{ fontSize: 11 }}
                                      />
                                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                                      <Tooltip 
                                          contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                          itemStyle={{ fontSize: '12px' }}
                                          labelFormatter={(label) => format(parseISO(label), 'yyyy-MM-dd')}
                                      />
                                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                      {selectedAthletes.map((id, index) => {
                                          const athleteName = latestRecords.find(r => r.id === id)?.name || id;
                                          return (
                                              <Line 
                                                  key={id}
                                                  type="monotone" 
                                                  dataKey={id} 
                                                  name={athleteName}
                                                  stroke={COLORS[index % COLORS.length]} 
                                                  strokeWidth={2}
                                                  dot={{ r: 3 }}
                                                  connectNulls
                                              />
                                          );
                                      })}
                                  </LineChart>
                              </ResponsiveContainer>
                          </div>

                          {/* 2. Current Snapshot Bar Chart */}
                          <div className="h-[250px] w-full border-t border-slate-800 pt-6">
                              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
                                  <BarChart2 className="w-4 h-4 mr-2 text-primary-500" />
                                  Latest Status Snapshot (Metric Comparison)
                              </h3>
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={comparisonSnapshotData} layout="horizontal" barGap={2}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                      <XAxis 
                                          dataKey="name" 
                                          stroke="#64748b" 
                                          tick={{ fontSize: 11 }} 
                                          interval={0}
                                      />
                                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                                      <Tooltip 
                                          cursor={{ fill: '#334155', opacity: 0.2 }}
                                          contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                      />
                                      <Legend iconType="rect" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                                      
                                      <Bar dataKey="jh" name="Jump Height" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                      <Bar dataKey="mrsi" name="mRSI" fill="#f97316" radius={[4, 4, 0, 0]} />
                                      <Bar dataKey="peakPropulsivePower" name="Power (W)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                          <Filter className="w-12 h-12 mb-3" />
                          <p>Select athletes from the sidebar to compare metrics.</p>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* Team Status Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Latest Athlete Status</h3>
            <Link to="/analysis" className="text-sm text-primary-500 hover:text-primary-400 flex items-center">
                Detailed Analysis <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-950 text-slate-200 uppercase font-medium text-xs">
                    <tr>
                        <th className="px-6 py-3">Athlete</th>
                        <th className="px-6 py-3">Last Recorded</th>
                        <th className="px-6 py-3 text-primary-500">JH (cm)</th>
                        <th className="px-6 py-3 text-accent-500">mRSI</th>
                        <th className="px-6 py-3 text-blue-400">Propulsive RFD</th>
                        <th className="px-6 py-3 text-orange-400">Braking RFD</th>
                        <th className="px-6 py-3">Asymmetry</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {latestRecords.map((record, i) => (
                        <tr key={i} className="hover:bg-slate-800/50 transition-colors group">
                            <td className="px-6 py-4 font-bold text-white group-hover:text-primary-400 transition-colors">
                                {record.name}
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-500 text-xs">{record.date}</td>
                            <td className="px-6 py-4 text-white font-medium">{record.jh}</td>
                            <td className="px-6 py-4">{record.mrsi}</td>
                            <td className="px-6 py-4">{record.propulsiveRfdSj}</td>
                            <td className="px-6 py-4">{record.brakingRfdCmj}</td>
                            <td className="px-6 py-4">
                                <span className={Math.abs(record.lrPeakBrakingForceDiff) > 5 ? 'text-rose-500 font-bold' : 'text-emerald-500'}>
                                    {record.lrPeakBrakingForceDiff}%
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;