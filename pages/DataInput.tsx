import React, { useState, useEffect } from 'react';
import { Save, Plus, User, CheckCircle } from 'lucide-react';
import { METRICS } from '../constants';
import { fetchData, addManualEntry } from '../services/dataService';
import { AthleteData } from '../types';

const DataInput: React.FC = () => {
  const [existingAthletes, setExistingAthletes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [isNewAthlete, setIsNewAthlete] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [metrics, setMetrics] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData().then(data => {
      const uniqueNames = Array.from(new Set(data.map(d => d.name))).sort();
      setExistingAthletes(uniqueNames);
      setLoading(false);
    });
  }, []);

  const handleMetricChange = (key: string, value: string) => {
    setMetrics(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newRecord: AthleteData = {
      id: name.replace(/\s+/g, '-').toLowerCase(),
      name: name,
      date: date,
      jh: metrics['jh'] || 0,
      avgPropulsiveForce: metrics['avgPropulsiveForce'] || 0,
      peakPropulsiveForce: metrics['peakPropulsiveForce'] || 0,
      peakPropulsivePower: metrics['peakPropulsivePower'] || 0,
      propulsiveRfdSj: metrics['propulsiveRfdSj'] || 0,
      mrsi: metrics['mrsi'] || 0,
      timeToTakeoff: metrics['timeToTakeoff'] || 0,
      brakingRfdCmj: metrics['brakingRfdCmj'] || 0,
      rsiDj: metrics['rsiDj'] || 0,
      lrPeakBrakingForceDiff: metrics['lrPeakBrakingForceDiff'] || 0,
      note: ''
    };

    addManualEntry(newRecord);
    setSuccessMsg(`Record saved for ${name} on ${date}`);
    
    // Refresh list if new athlete
    if (isNewAthlete && !existingAthletes.includes(name)) {
        setExistingAthletes(prev => [...prev, name].sort());
        setIsNewAthlete(false);
    }
    
    // Clear metrics for next entry, keep name/date
    setMetrics({});
    
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Manual Data Entry</h1>
        <p className="text-slate-400">Add new performance records for athletes manually.</p>
      </div>

      {successMsg && (
          <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-500 p-4 rounded-xl mb-6 flex items-center animate-pulse">
              <CheckCircle className="w-5 h-5 mr-3" />
              {successMsg}
          </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {/* Top Section: Athlete & Date */}
        <div className="p-6 border-b border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/30">
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Athlete Name</label>
                {isNewAthlete ? (
                    <div className="flex gap-2">
                         <input 
                            type="text" 
                            required
                            placeholder="Enter full name"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                            value={name}
                            onChange={e => setName(e.target.value)}
                         />
                         <button 
                            type="button"
                            onClick={() => setIsNewAthlete(false)}
                            className="text-xs text-slate-400 hover:text-white underline"
                         >
                            Select Existing
                         </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <select 
                            required
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none appearance-none"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        >
                            <option value="">-- Select Athlete --</option>
                            {existingAthletes.map(a => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                        <button 
                            type="button"
                            onClick={() => { setIsNewAthlete(true); setName(''); }}
                            className="bg-slate-800 border border-slate-700 p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Add New Athlete"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                <input 
                    type="date" 
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                />
            </div>
        </div>

        {/* Metrics Section */}
        <div className="p-6 grid grid-cols-1 gap-8">
            
            {/* Performance Category */}
            <div>
                <h3 className="text-sm font-bold text-primary-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                    Performance Metrics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    {METRICS.filter(m => m.category === 'performance').map(metric => (
                        <div key={metric.key}>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">{metric.label} ({metric.unit})</label>
                            <input 
                                type="number" 
                                step="0.01"
                                placeholder="0.00"
                                className="w-full bg-slate-950/50 border border-slate-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm transition-all"
                                value={metrics[metric.key] || ''}
                                onChange={e => handleMetricChange(metric.key as string, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Injury Prevention Category */}
            <div>
                <h3 className="text-sm font-bold text-accent-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                    Injury Prevention Strategy
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    {METRICS.filter(m => m.category === 'injury_prevention').map(metric => (
                        <div key={metric.key}>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">{metric.label} ({metric.unit})</label>
                            <input 
                                type="number" 
                                step="0.01"
                                placeholder="0.00"
                                className="w-full bg-slate-950/50 border border-slate-700 rounded px-3 py-2 text-white focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none text-sm transition-all"
                                value={metrics[metric.key] || ''}
                                onChange={e => handleMetricChange(metric.key as string, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-950/30 border-t border-slate-800 flex justify-end">
            <button 
                type="submit"
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
            >
                <Save className="w-4 h-4" />
                Save Record
            </button>
        </div>
      </form>
    </div>
  );
};

export default DataInput;