import React, { useState, useEffect } from 'react';
import { Save, FileSpreadsheet, Upload, Trash2, CheckCircle, AlertCircle, Database, Download, FileJson, Info, AlertTriangle, RefreshCw, Zap, Play } from 'lucide-react';
import { getSheetUrl, saveSheetUrl, processFile, getDataSourceType, clearLocalData, fetchData, getManualEntries, saveGoogleScriptUrl, getGoogleScriptUrl, testGoogleSheetConnection } from '../services/dataService';

declare const XLSX: any;

const Settings: React.FC = () => {
  const [url, setUrl] = useState('');
  const [scriptUrl, setScriptUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [scriptSaved, setScriptSaved] = useState(false);
  const [sourceType, setSourceType] = useState('demo');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  
  // Test Connection State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState({ message: '', count: 0 });

  useEffect(() => {
    setUrl(getSheetUrl());
    setScriptUrl(getGoogleScriptUrl());
    setSourceType(getDataSourceType());
  }, []);

  const handleUrlSave = () => {
    saveSheetUrl(url.trim());
    setSaved(true);
    setTimeout(() => {
        setSaved(false);
        window.location.reload();
    }, 1500);
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
    setTimeout(() => setScriptSaved(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    try {
        await processFile(file);
        setUploadStatus('success');
        setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
        setUploadStatus('error');
        setUploadError('Failed to parse file. Ensure it is a valid Excel or CSV file.');
        console.error(err);
    }
  };

  const handleClearLocal = () => {
      if (confirm('Are you sure? This will remove the uploaded Excel/CSV data and revert to the Google Sheet or Demo data.')) {
          clearLocalData();
          window.location.reload();
      }
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
    <div className="max-w-3xl mx-auto space-y-8 pb-10">
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
        
        <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-sm">
            <span className="text-slate-400 mr-2">Current Source:</span>
            {sourceType === 'local_file' && <span className="text-emerald-500 font-bold flex items-center"><FileSpreadsheet className="w-4 h-4 mr-1"/> Uploaded File</span>}
            {sourceType === 'google_sheet' && <span className="text-primary-500 font-bold flex items-center"><FileSpreadsheet className="w-4 h-4 mr-1"/> Google Sheet</span>}
            {sourceType === 'demo' && <span className="text-accent-500 font-bold">Demo Mode</span>}
        </div>
      </div>

      {/* Option 2: Google Sheet Reading */}
      <div className={`bg-slate-900 border rounded-xl p-6 shadow-lg transition-all ${sourceType === 'google_sheet' ? 'border-primary-500 ring-1 ring-primary-500/20' : 'border-slate-800'}`}>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <FileSpreadsheet className="w-5 h-5 mr-2 text-primary-500" />
            Google Sheet Connection (Read Only)
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
                    <p className="text-xs text-slate-500 italic">
                        Updates using this method are nearly instant.
                    </p>
                 </div>
             </div>
             <div className="mt-4 pt-4 border-t border-slate-800 flex items-start gap-3 opacity-75">
                 <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                 <div>
                    <p className="font-semibold text-slate-400 mb-1">Alternative: Publish to Web (Cached)</p>
                    <p className="text-slate-500">
                        You can also use "File &gt; Share &gt; Publish to web (CSV)". However, Google caches this data, so updates may be <strong>delayed by 5-10 minutes</strong>.
                    </p>
                 </div>
             </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Google Sheet Link
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-sm text-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-slate-600"
            />
          </div>
          
          <div className="flex items-center gap-3">
              <button
                onClick={handleUrlSave}
                className="flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Save className="w-4 h-4 mr-2" />
                {saved ? 'Saved & Refreshing...' : 'Save Connection'}
              </button>
              
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
            Automatic Google Sheet Backup (Write Access)
        </h2>
        
        <div className="space-y-4">
            <div className="bg-slate-950/50 p-4 rounded-lg text-sm text-slate-400 border border-slate-700/50">
                <p className="mb-2 font-semibold text-slate-300">How to enable automatic backup:</p>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li>Open your Google Sheet.</li>
                    <li>Go to <strong>Extensions {'>'} Apps Script</strong>.</li>
                    <li>Paste the backup script.</li>
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

      {/* Option 1: File Upload */}
      <div className={`bg-slate-900 border rounded-xl p-6 shadow-lg transition-all ${sourceType === 'local_file' ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-slate-800'}`}>
        <div className="flex justify-between items-start mb-4">
             <h2 className="text-lg font-semibold text-white flex items-center">
                <Upload className="w-5 h-5 mr-2 text-emerald-500" /> 
                Upload Excel / CSV (Local Override)
            </h2>
            {sourceType === 'local_file' && (
                <button 
                    onClick={handleClearLocal}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center px-2 py-1 bg-rose-950/30 rounded border border-rose-900/50"
                >
                    <Trash2 className="w-3 h-3 mr-1" /> Remove File
                </button>
            )}
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
             Directly upload an Excel file (.xlsx, .xls) or CSV to serve as the main database. This will override any Google Sheet connection.
          </p>
          
          <div className="relative">
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-400
                  file:mr-4 file:py-2.5 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-slate-800 file:text-emerald-500
                  hover:file:bg-slate-700
                  cursor-pointer bg-slate-950/50 border border-slate-700 rounded-lg p-1"
              />
          </div>

          {uploadStatus === 'uploading' && (
              <div className="text-sm text-emerald-500 animate-pulse">Processing file...</div>
          )}
          {uploadStatus === 'success' && (
              <div className="text-sm text-emerald-500 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" /> 
                  File processed successfully! Reloading...
              </div>
          )}
          {uploadStatus === 'error' && (
              <div className="text-sm text-rose-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" /> 
                  {uploadError}
              </div>
          )}
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
    </div>
  );
};

export default Settings;
