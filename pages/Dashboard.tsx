import React, { useEffect, useState, useMemo } from 'react';
import { Users, TrendingUp, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchData } from '../services/dataService';
import { AthleteData } from '../types';
import ChartSection from '../components/ChartSection';
import { METRICS } from '../constants';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<AthleteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());

  const loadDashboardData = async () => {
      setSyncing(true);
      const fetchedData = await fetchData();
      setData(fetchedData);
      setLastSynced(new Date());
      setLoading(false);
      setSyncing(false);
  };

  useEffect(() => {
    // Initial fetch
    loadDashboardData();

    // Auto-refresh every 5 minutes (300,000ms) to simulate real-time sync from Google Sheet
    const interval = setInterval(() => {
        loadDashboardData();
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  // Process data to find the latest record for each athlete
  const latestRecords = useMemo(() => {
    const latestMap = new Map<string, AthleteData>();
    data.forEach(record => {
        const existing = latestMap.get(record.id);
        if (!existing || new Date(record.date) > new Date(existing.date)) {
            latestMap.set(record.id, record);
        }
    });
    return Array.from(latestMap.values()).sort((a, b) => b.jh - a.jh); // Default sort by Jump Height
  }, [data]);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Dashboard...</div>;

  // Aggregate stats
  const totalAthletes = latestRecords.length;
  
  // Calculate average team RSI for recent date
  const avgTeamRSI = latestRecords.reduce((acc, curr) => acc + curr.mrsi, 0) / (totalAthletes || 1);
  const avgTeamJH = latestRecords.reduce((acc, curr) => acc + curr.jh, 0) / (totalAthletes || 1);

  // Prepare data for "Team Trend" chart (Average JH over time)
  // Group by date
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
                    title="Click to force sync with Google Sheets"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Trend Chart */}
        <div className="lg:col-span-2">
            <ChartSection 
                title="Team Performance Trend (Avg JH)" 
                data={teamTrendData} 
                metrics={[METRICS.find(m => m.key === 'jh')!]} 
                height={350}
            />
        </div>

        {/* Quick Actions / Notices */}
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
                         {latestRecords.sort((a,b) => b.mrsi - a.mrsi)[0]?.name || '-'}
                     </p>
                     <p className="text-accent-500 text-sm">
                         {latestRecords.sort((a,b) => b.mrsi - a.mrsi)[0]?.mrsi}
                     </p>
                </div>
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