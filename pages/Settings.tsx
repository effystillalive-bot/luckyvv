import React, { useState, useEffect } from 'react';
import { Save, FileSpreadsheet, Upload, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { getSheetUrl, saveSheetUrl, processFile, getDataSourceType, clearLocalData } from '../services/dataService';

const Settings: React.FC = () => {
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [sourceType, setSourceType] = useState('demo');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    setUrl(getSheetUrl());
    setSourceType(getDataSourceType());
  }, []);

  const handleUrlSave = () => {
    saveSheetUrl(url);
    setSaved(true);
    setTimeout(() => {
        setSaved(false);
        window.location.reload();
    }, 1500);
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

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Data Source Settings</h1>
        <p className="text-slate-400">Configure where the application pulls athlete data from.</p>
        
        <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-sm">
            <span className="text-slate-400 mr-2">Current Source:</span>
            {sourceType === 'local_file' && <span className="text-emerald-500 font-bold flex items-center"><FileSpreadsheet className="w-4 h-4 mr-1"/> Uploaded File</span>}
            {sourceType === 'google_sheet' && <span className="text-primary-500 font-bold flex items-center"><FileSpreadsheet className="w-4 h-4 mr-1"/> Google Sheet</span>}
            {sourceType === 'demo' && <span className="text-accent-500 font-bold">Demo Mode</span>}
        </div>
      </div>

      {/* Option 1: File Upload */}
      <div className={`bg-slate-900 border rounded-xl p-6 shadow-lg transition-all ${sourceType === 'local_file' ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-slate-800'}`}>
        <div className="flex justify-between items-start mb-4">
             <h2 className="text-lg font-semibold text-white flex items-center">
                <Upload className="w-5 h-5 mr-2 text-emerald-500" /> 
                Upload Excel / CSV
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
             Directly upload an Excel file (.xlsx, .xls) or CSV. The data stays in your browser storage.
             <br/><span className="text-xs opacity-75">Prioritized over Google Sheet URL if present.</span>
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

      {/* Option 2: Google Sheet */}
      <div className={`bg-slate-900 border rounded-xl p-6 shadow-lg transition-all ${sourceType === 'google_sheet' ? 'border-primary-500 ring-1 ring-primary-500/20' : 'border-slate-800'}`}>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <FileSpreadsheet className="w-5 h-5 mr-2 text-primary-500" />
            Google Sheet Connection
        </h2>
        
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
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={handleUrlSave}
            className="flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            {saved ? 'Saved!' : 'Save Configuration'}
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Make sure the sheet is visible to "Anyone with the link" or published to the web as CSV.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;