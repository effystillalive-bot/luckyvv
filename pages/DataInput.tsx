import React, { useState, useEffect } from 'react';
import { Save, Plus, CheckCircle, Upload, FileText, AlertCircle, Database, Download, RefreshCw } from 'lucide-react';
import { METRICS } from '../constants';
import { fetchData, addManualEntry, parseFile, batchAddManualEntries, backupToGoogleSheet, getManualEntries, syncBatchToGoogleSheet, getGoogleScriptUrl } from '../services/dataService';
import { AthleteData } from '../types';

declare const XLSX: any;

const DataInput: React.FC = () => {
  const [existingAthletes, setExistingAthletes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Batch Import State
  const [batchStatus, setBatchStatus] = useState<'idle' | 'uploading' | 'syncing' | 'success' | 'error'>('idle');
  const [batchError, setBatchError] = useState('');
  const [batchCount, setBatchCount] = useState(0);
  const [batchSyncProgress, setBatchSyncProgress] = useState({ current: 0, total: 0 });

  // Manual Form State
  const [isNewAthlete, setIsNewAthlete] = useState(false);
  const [name, setName] = useState('');
  
  // Use local date for default value (YYYY-MM-DD)
  const [date, setDate] = useState(() => {
    const now = new Date();
    // Adjust for timezone offset to get correct local date string
    const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    return local.toISOString().split('T')[0];
  });

  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');

  const loadAthletes = async () => {
    setLoadingAthletes(true);
    try {
        const data = await fetchData();
        const uniqueNames = Array.from(new Set(data.map(d => d.name))).sort();
        setExistingAthletes(uniqueNames);
    } catch (e) {
        console.error("Failed to load athletes", e);
    } finally {
        setLoading(false);
        setLoadingAthletes(false);
    }
  };

  useEffect(() => {
    loadAthletes();
  }, []);

  const handleMetricChange = (key: string, value: string) => {
    setMetrics(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setBatchStatus('uploading');
      setBatchError('');
      
      try {
          const parsedData = await parseFile(file);
          if (parsedData.length === 0) {
              setBatchStatus('error');
              setBatchError('No valid athlete data found in file.');
              return;
          }
          
          // 1. Save locally
          batchAddManualEntries(parsedData);
          setBatchCount(parsedData.length);
          
          // Refresh list
          const uniqueNames = Array.from(new Set([...existingAthletes, ...parsedData.map(d => d.name)])).sort();
          setExistingAthletes(uniqueNames);

          // 2. Sync to Cloud if configured
          const scriptUrl = getGoogleScriptUrl();
          if (scriptUrl) {
              setBatchStatus('syncing');
              setBatchSyncProgress({ current: 0, total: parsedData.length });
              
              await syncBatchToGoogleSheet(parsedData, (count) => {
                  setBatchSyncProgress({ current: count, total: parsedData.length });
              });
          }
          
          setBatchStatus('success');
          
      } catch (err) {
          console.error(err);
          setBatchStatus('error');
          setBatchError('Failed to parse file. Check format.');
      }
  };

  const handleQuickBackup = () => {
    const manualData = getManualEntries();
    if (manualData.length === 0) return alert("No manual data to backup.");
    
    const timestamp = new Date().toISOString().split('T')[0];
    const ws = XLSX.utils.json_to_sheet(manualData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manual Data");
    XLSX.writeFile(wb, `proformance_manual_backup_${timestamp}.xlsx`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      note: note
    };

    // 1. Save locally
    addManualEntry(newRecord);
    setSuccessMsg(`Record saved locally.`);
    
    // 2. Try Cloud Backup
    setBackupStatus('syncing');
    const cloudSuccess = await backupToGoogleSheet(newRecord);
    if (cloudSuccess) {
        setBackupStatus('success');
        setSuccessMsg(`Record saved locally and synced to Google Sheet.`);
    } else {
        setBackupStatus('error');
    }
    
    // Refresh list if new athlete
    if (isNewAthlete && !existingAthletes.includes(name)) {
        setExistingAthletes(prev => [...prev, name].sort());
        setIsNewAthlete(false);
    }
    
    // Clear metrics for next entry, keep name/date
    setMetrics({});
    setNote('');
    
    setTimeout(() => {
        setSuccessMsg('');
        setBackupStatus('idle');
    }, 4000);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-8">
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-bold text-white mb-2">Data Management</h1>
            <p className="text-slate-400">Import bulk data or add individual records.</p>
        </div>
        <button 
            onClick={handleQuickBackup}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-3 py-2 rounded-lg border border-slate-700 transition-colors"
            title="Download Excel backup of manual entries"
        >
            <Download className="w-4 h-4" /> Backup Manual Data
        </button>
      </div>

      {successMsg && (
          <div className={`p-4 rounded-xl flex items-center animate-pulse border ${backupStatus === 'error' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500'}`}>
              <CheckCircle className="w-5 h-5 mr-3" />
              <div>
                  <p>{successMsg}</p>
                  {backupStatus === 'error' && <p className="text-xs mt-1 opacity-80">Note: Google Sheet sync failed (check Settings), but local save works.</p>}
              </div>
          </div>
      )}

      {/* Manual Entry Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
            <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent-500" />
                <h2 className="text-lg font-semibold text-white">Manual Entry</h2>
            </div>
            {backupStatus === 'syncing' && <div className="text-xs text-purple-400 animate-pulse">Syncing to Cloud...</div>}
        </div>

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
                            onClick={loadAthletes}
                            disabled={loadingAthletes}
                            className="bg-slate-800 border border-slate-700 p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Refresh Athlete List"
                        >
                            <RefreshCw className={`w-5 h-5 ${loadingAthletes ? 'animate-spin' : ''}`} />
                        </button>
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
        <form onSubmit={handleSubmit}>
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

                {/* Note Field */}
                <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                        Session Notes
                    </h3>
                    <textarea 
                        className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-white focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none text-sm transition-all placeholder:text-slate-600 resize-y min-h-[80px]"
                        placeholder="Optional: Add daily context, injury status, or session observations..."
                        value={note}
                        onChange={e => setNote(e.target.value)}
                    />
                </div>

            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-slate-950/30 border-t border-slate-800 flex justify-end">
                <button 
                    type="submit"
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                >
                    <Save className="w-4 h-4" />
                    Save & Sync Record
                </button>
            </div>
        </form>
      </div>

      {/* Batch Import Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary-500" /> Batch Data Import
          </h2>
          <div className="bg-slate-950/50 rounded-lg border border-slate-700 border-dashed p-6 text-center">
              <p className="text-sm text-slate-400 mb-4">
                  Upload CSV, Excel (.xlsx), or JSON files. Data will be merged with existing records and synced to Google Sheets (if enabled).
              </p>
              <input 
                  type="file" 
                  accept=".csv, .json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleBatchUpload}
                  className="block w-full max-w-sm mx-auto text-sm text-slate-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary-600 file:text-white
                  hover:file:bg-primary-500
                  cursor-pointer bg-slate-900 border border-slate-700 rounded-full"
              />
              
              {batchStatus === 'uploading' && (
                  <div className="mt-4 text-primary-400 text-sm animate-pulse">Parsing file...</div>
              )}

              {batchStatus === 'syncing' && (
                  <div className="mt-4 flex flex-col items-center">
                      <div className="text-purple-400 text-sm animate-pulse font-medium mb-1">
                          Syncing to Google Sheets...
                      </div>
                      <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                              className="h-full bg-purple-500 transition-all duration-300"
                              style={{ width: `${(batchSyncProgress.current / batchSyncProgress.total) * 100}%` }}
                          />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                          {batchSyncProgress.current} / {batchSyncProgress.total} records
                      </div>
                  </div>
              )}
              
              {batchStatus === 'success' && (
                  <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-500 px-4 py-2 rounded-lg border border-emerald-500/50 animate-bounce">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-bold">Success! Imported {batchCount} records.</span>
                  </div>
              )}
              
              {batchStatus === 'error' && (
                  <div className="mt-4 text-rose-500 text-sm flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4" /> {batchError}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default DataInput;