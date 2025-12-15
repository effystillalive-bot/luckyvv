import React, { useState, useEffect } from 'react';
import { Save, FileSpreadsheet, CheckCircle, Database, Download, FileJson, AlertTriangle, RefreshCw, Zap, Play, Activity, Edit2, X } from 'lucide-react';
import { getSheetUrl, saveSheetUrl, getDataSourceType, fetchData, getManualEntries, saveGoogleScriptUrl, getGoogleScriptUrl, testGoogleSheetConnection, checkSyncStatus } from '../services/dataService';

declare const XLSX: any;

const Settings: React.FC = () => {
  const [url, setUrl] = useState('');
  const [scriptUrl, setScriptUrl] = useState('');
  const [scriptSaved, setScriptSaved] = useState(false);
  const [sourceType, setSourceType] = useState('demo');
  
  // URL Input State
  const [isUrlLocked, setIsUrlLocked] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [countdown, setCountdown] = useState(3);
  
  // Test Connection State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState({ message: '', count: 0 });
  const [syncStatus, setSyncStatus] = useState({ read: false, write: false });

  useEffect(() => {
    const savedUrl = getSheetUrl();
    setUrl(savedUrl);
    setScriptUrl(getGoogleScriptUrl());
    setSourceType(getDataSourceType());
    setSyncStatus(checkSyncStatus());

    // Lock the input if a URL is already saved and it's not the default demo one (if applicable)
    if (savedUrl && savedUrl.length > 10) {
        setIsUrlLocked(true);
    }
  }, []);

  // Handle Success Modal Countdown
  useEffect(() => {
      let timer: any;
      if (showSuccessModal && countdown > 0) {
          timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      } else if (showSuccessModal && countdown === 0) {
          setShowSuccessModal(false);
          // Optional: Reload to apply changes if needed, or just let user manually refresh
          // window.location.reload(); 
      }
      return () => clearTimeout(timer);
  }, [showSuccessModal, countdown]);

  const handleUrlSave = () => {
    saveSheetUrl(url.trim());
    
    // Trigger Success UI
    setCountdown(3);
    setShowSuccessModal(true);
    setIsUrlLocked(true); // Lock it back
    setTestStatus('idle'); // Reset test status
  };

  const handleEditUrl = () => {
      setIsUrlLocked(false);
  };

  const handleTestConnection = async () => {
      setTestStatus('testing');
      const result = await testGoogleSheetConnection(url.trim());
      setTestResult({ message: result.message, count: result.count });
      setTestStatus(result.success ? 'success' : 'error');
  };

  const handleScriptUrlSave = () => {
    if (scriptUrl.includes('docs.google.com/spreadsheets')) {
        alert("Warning: It looks like you pasted a Google Sheet URL. \n\nPlease paste the 'Web App URL' from the Apps Script deployment (starts with https://script.google.com/macros/s/...).");
        return;
    }
    
    saveGoogleScriptUrl(scriptUrl);
    setScriptSaved(true);
    setSyncStatus(checkSyncStatus()); // Re-check
    setTimeout(() => setScriptSaved(false), 2000);
  };

  const handleExportBackup = async (format: 'xlsx' | 'json') => {
      const data = await fetchData();
      const manualData = getManualEntries();
      const timestamp = new Date().toISOString().split('T')[0];

      if (format === 'json') {
           const jsonString = JSON.stringify(data, null, 2);
           const blob = new Blob([jsonString], { type: "application/json" });
           const link = document.createElement("a");
           link.href = URL.createObjectURL(blob);
           link.download = `proformance_backup_full_${timestamp}.json`;
           document.body.appendChild(link);
           link.click();
           document.body.removeChild(link);
      } else {
           const ws = XLSX.utils.json_to_sheet(data);
           const wb = XLSX.utils.book_new();
           XLSX.utils.book_append_sheet(wb, ws, "Full Backup");
           
           if (manualData.length > 0) {
               const wsManual = XLSX.utils.json_to_sheet(manualData);
               XLSX.utils.book_append_sheet(wb, wsManual, "Manual Entries Only");
           }
           
           XLSX.writeFile(wb, `proformance_backup_${timestamp}.xlsx`);
      }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10 relative">
      <div>
        <div className="flex justify-between items-center">
             <div>
                <h1 className="text-2xl font-bold text-white mb-2">Data Source Settings</h1>
                <p className="text-slate-400">Configure where the application pulls athlete data from.</p>
             </div>
             <button 
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 border border-slate-700 transition-colors"
                title="Reload the app to fetch the latest data"
             >
                <RefreshCw className="w-4 h-4" /> Force Refresh App
             </button>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-4 items-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-sm">
                <span className="text-slate-400 mr-2">Current Source:</span>
                {sourceType === 'local_file' && <span className="text-emerald-500 font-bold flex items-center"><FileSpreadsheet className="w-4 h-4 mr-1"/> Uploaded File</span>}
                {sourceType === 'google_sheet' && <span className="text-primary-500 font-bold flex items-center"><FileSpreadsheet className="w-4 h-4 mr-1"/> Google Sheet</span>}
                {sourceType === 'demo' && <span className="text-accent-500 font-bold">Demo Mode</span>}
            </div>

            {/* Sync Health Indicator */}
            <div className={`inline-flex items-center px-3 py-1 rounded-full border text-sm ${syncStatus.read && syncStatus.write ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                <Activity className="w-4 h-4 mr-2" />
                <span className="mr-2">Two-Way Sync:</span>
                {syncStatus.read && syncStatus.write ? (
                    <span className="font-bold flex items-center">Active <CheckCircle className="w-3 h-3 ml-1" /></span>
                ) : (
                    <span className="flex items-center">
                        Partial 
                        <span className="text-xs ml-1 opacity-70">
                            ({syncStatus.read ? 'Read Only' : 'No Connection'})
                        </span>
                    </span>
                )}
            </div>
        </div>
      </div>

      {/* Option 2: Google Sheet Reading */}
      <div className={`bg-slate-900 border rounded-xl p-6 shadow-lg transition-all ${sourceType === 'google_sheet' ? 'border-primary-500 ring-1 ring-primary-500/20' : 'border-slate-800'}`}>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <FileSpreadsheet className="w-5 h-5 mr-2 text-primary-500" />
            Google Sheet Connection (Read Data)
        </h2>
        
        <div className="bg-slate-950/50 p-4 rounded-lg text-sm text-slate-400 border border-slate-700/50 mb-6">
             <div className="flex items-start gap-3">
                 <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                 <div>
                    <p className="font-bold text-slate-200 mb-2">Recommended: Instant Updates (Share Method)</p>
                    <ol className="list-decimal list-inside space-y-1.5 ml-1 mb-3">
                        <li>Open your Google Sheet.</li>
                        <li>Click <strong>Share (共用)</strong> in the top right.</li>
                        <li>Under General Access, select <strong>"Anyone with the link"</strong> as <strong>"Viewer"</strong>.</li>
                        <li>Click <strong>Copy link (複製連結)</strong> and paste it below.</li>
                    </ol>
                 </div>
             </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Google Sheet Link
            </label>
            <div className="relative group">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isUrlLocked}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className={`w-full border rounded-lg p-3 pr-24 text-sm outline-none transition-all 
                      ${isUrlLocked 
                          ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed select-none' 
                          : 'bg-slate-950/50 text-white border-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 placeholder:text-slate-600'
                      }`}
                />
                
                {/* Action Button inside input */}
                <div className="absolute right-2 top-1.5 bottom-1.5">
                    {isUrlLocked ? (
                        <button 
                            onClick={handleEditUrl}
                            className="h-full px-3 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors flex items-center gap-1"
                        >
                            <Edit2 className="w-3.5 h-3.5" /> Change
                        </button>
                    ) : (
                        <button 
                            onClick={handleUrlSave}
                            className="h-full px-3 text-xs font-medium text-white bg-primary-600 hover:bg-primary-500 rounded transition-colors flex items-center gap-1 shadow-lg shadow-primary-900/20"
                        >
                            <Save className="w-3.5 h-3.5" /> Save
                        </button>
                    )}
                </div>
            </div>
            {isUrlLocked && <p className="text-[10px] text-slate-600 mt-1 ml-1">URL is saved and locked. Click "Change" to update.</p>}
          </div>
          
          <div className="flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={!url || testStatus === 'testing'}
                className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {testStatus === 'testing' ? (
                     <span className="flex items-center"><RefreshCw className="w-4 h-4 mr-2 animate-spin"/> Testing...</span>
                ) : (
                     <span className="flex items-center"><Play className="w-4 h-4 mr-2"/> Test Connection</span>
                )}
              </button>
          </div>

          {/* Test Results UI */}
          {testStatus === 'success' && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-3 text-emerald-500 text-sm animate-in fade-in slide-in-from-top-2">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <div>
                      <p className="font-bold">{testResult.message}</p>
                      <p className="text-xs mt-1 text-emerald-400/80">If you just updated the sheet, try refreshing the dashboard.</p>
                  </div>
              </div>
          )}
          {testStatus === 'error' && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-3 text-rose-500 text-sm animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                      <p className="font-bold">Connection Failed</p>
                      <p>{testResult.message}</p>
                      <p className="mt-1 text-xs">Tip: Ensure "General Access" is set to "Anyone with the link".</p>
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* Option 3: Google Apps Script for Writing */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-purple-500" />
            Automatic Google Sheet Backup (Write Data)
        </h2>
        
        <div className="space-y-4">
            <div className="bg-slate-950/50 p-4 rounded-lg text-sm text-slate-400 border border-slate-700/50">
                <p className="mb-2 font-semibold text-slate-300">How to enable automatic backup:</p>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li>Open your Google Sheet.</li>
                    <li>Go to <strong>Extensions {'>'} Apps Script</strong>.</li>
                    <li>Paste the backup script provided.</li>
                    <li>Click <strong>Deploy {'>'} New deployment {'>'} Web App</strong>.</li>
                    <li>Set "Who has access" to <strong>"Anyone"</strong>.</li>
                    <li>Copy the URL (starts with script.google.com) and paste it below.</li>
                </ol>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Google Apps Script Web App URL
                </label>
                <input
                  type="text"
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/..."
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-600"
                />
            </div>
            <button
                onClick={handleScriptUrlSave}
                className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm font-medium"
            >
                <Save className="w-4 h-4 mr-2" />
                {scriptSaved ? 'Connected!' : 'Save Script URL'}
            </button>
        </div>
      </div>

       {/* Data Backup Section */}
       <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
           <h2 className="text-lg font-semibold text-white mb-2 flex items-center">
               <Download className="w-5 h-5 mr-2 text-sky-500" />
               Data Backup & Preservation
           </h2>
           <p className="text-sm text-slate-400 mb-6">
               Since this application runs in your browser, perform regular backups to ensure your data is safe even if you clear your cache.
           </p>

           <div className="flex flex-wrap gap-4">
               <button 
                   onClick={() => handleExportBackup('xlsx')}
                   className="flex items-center px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-all"
               >
                   <FileSpreadsheet className="w-5 h-5 mr-2 text-emerald-500" />
                   Export Full Backup (.xlsx)
               </button>
               <button 
                   onClick={() => handleExportBackup('json')}
                   className="flex items-center px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-all"
               >
                   <FileJson className="w-5 h-5 mr-2 text-amber-500" />
                   Export Full Backup (.json)
               </button>
           </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-sm w-full shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200 text-center relative">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Connection Saved!</h3>
                  <p className="text-slate-400 text-sm mb-6">
                      Your Google Sheet link has been updated successfully.
                  </p>
                  
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mb-4">
                      <div className="bg-emerald-500 h-full transition-all duration-1000 ease-linear" style={{ width: `${(countdown / 3) * 100}%` }}></div>
                  </div>
                  
                  <button 
                    onClick={() => setShowSuccessModal(false)}
                    className="text-xs text-slate-500 hover:text-white"
                  >
                      Closing in {countdown}s...
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;