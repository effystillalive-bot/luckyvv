import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Search, Save, FileText, Calendar, User, ChevronLeft, ChevronRight, FileSpreadsheet, Download, FileJson, Trash2, GripVertical, Settings2, Check, Plus, X, Activity, RefreshCw, Edit2, XCircle } from 'lucide-react';
import { fetchData, saveNote, saveAthleteNote, getAthleteNotes, deleteSpecificEntry, deleteAthleteProfile, saveAthleteOrder, getAthleteOrder, addManualEntry, backupToGoogleSheet } from '../services/dataService';
import { AthleteData } from '../types';
import ChartSection from '../components/ChartSection';
import MetricCard from '../components/MetricCard';
import { METRICS } from '../constants';

declare const XLSX: any;
declare const html2canvas: any;
declare const window: any;

const Analysis: React.FC = () => {
  const [rawData, setRawData] = useState<AthleteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  
  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isManageMode, setIsManageMode] = useState(false); // Mode to delete/sort athletes
  
  // Filtering State
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Notes State
  const [editingNote, setEditingNote] = useState<{id: string, date: string, text: string} | null>(null);
  const [athleteNote, setAthleteNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isSyncingNote, setIsSyncingNote] = useState(false);

  // Row Editing State (Full Record)
  const [editingRow, setEditingRow] = useState<string | null>(null); // Key: id_date
  const [editForm, setEditForm] = useState<AthleteData | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // Sorting State
  const [athleteOrder, setAthleteOrder] = useState<string[]>([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  
  // Add Data Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEntryMetrics, setNewEntryMetrics] = useState<Record<string, number>>({});
  const [isSavingNewEntry, setIsSavingNewEntry] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    // Responsive sidebar init
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    // Set initial
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = async (isBackgroundRefresh = false) => {
      if (!isBackgroundRefresh) setSyncing(true);
      
      const data = await fetchData();
      
      // Sort data by date ascending
      data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setRawData(data);
      setLastSynced(new Date());

      if (!isBackgroundRefresh) {
          const savedOrder = getAthleteOrder();
          setAthleteOrder(savedOrder);
      }
      setSyncing(false);
      return data;
  };

  useEffect(() => {
    // Initial Load
    loadData(false).then((data) => {
      // Default selection if none
      if (data.length > 0 && !selectedAthleteId) {
        setSelectedAthleteId(data[0].id);
        
        // Default Date Range: Last 6 months or full range
        const dates = data.map(d => new Date(d.date).getTime());
        const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
        const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
        setDateRange({ start: minDate, end: maxDate });
      }
      setLoading(false);
    });

    // Auto-refresh Polling (every 5 minutes)
    const interval = setInterval(() => {
        // Only refresh if not actively dragging or in modal/editing to avoid jitter
        if (!isAddModalOpen && !draggedItemIndex && !editingRow) {
            loadData(true);
        }
    }, 300000);

    return () => clearInterval(interval);
  }, [editingRow, isAddModalOpen, draggedItemIndex]);

  // Sync Athlete General Note
  useEffect(() => {
      if (selectedAthleteId) {
          const notes = getAthleteNotes();
          setAthleteNote(notes[selectedAthleteId] || '');
      }
  }, [selectedAthleteId]);

  // Compute sorted athlete list
  const athletes = useMemo(() => {
    const unique = new Map();
    rawData.forEach(d => unique.set(d.id, d.name));
    
    let list = Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
    
    // Apply sort order
    if (athleteOrder.length > 0) {
        list.sort((a, b) => {
            const idxA = athleteOrder.indexOf(a.id);
            const idxB = athleteOrder.indexOf(b.id);
            // If both exist in order array, sort by index
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            // If one exists, put it first
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            // Otherwise alphabetical
            return a.name.localeCompare(b.name);
        });
    } else {
        // Default alpha
        list.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return list;
  }, [rawData, athleteOrder]);

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

  // --- Row Editing Handlers ---

  const handleStartEdit = (record: AthleteData) => {
    setEditingRow(`${record.id}_${record.date}`);
    setEditForm({ ...record });
    // Cancel any single note edit
    setEditingNote(null);
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditForm(null);
  };

  const handleEditChange = (key: keyof AthleteData, value: string) => {
    if (!editForm) return;
    setEditForm(prev => {
        if (!prev) return null;
        if (key === 'note') {
            return { ...prev, note: value };
        } else if (key === 'name' || key === 'id' || key === 'date') {
             return { ...prev, [key]: value };
        } else {
            return { ...prev, [key]: parseFloat(value) || 0 };
        }
    });
  };

  const handleSaveEdit = async () => {
      if (!editForm) return;
      setIsSavingEdit(true);

      // 1. Save Local (Manual Entry Overrides)
      addManualEntry(editForm);
      
      // 2. Explicitly Save Note if changed (Since notes have separate storage priority)
      if (editForm.note !== undefined) {
          saveNote(editForm.id, editForm.date, editForm.note);
      }

      // 3. Backup to Google Sheet (Cloud Sync)
      // This appends the updated record to the sheet log
      await backupToGoogleSheet(editForm);

      // 4. Update UI State Optimistically
      const newData = [...rawData];
      const idx = newData.findIndex(d => d.id === editForm.id && d.date === editForm.date);
      if (idx !== -1) {
          newData[idx] = editForm;
      } else {
          newData.push(editForm);
          newData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      setRawData(newData);

      setIsSavingEdit(false);
      setEditingRow(null);
      setEditForm(null);
  };

  // --- Deletion Handlers ---

  const handleDeleteRecord = async (record: AthleteData) => {
      if (window.confirm(`Delete record for ${record.date}? This cannot be undone.`)) {
          deleteSpecificEntry(record.id, record.date);
          await loadData(false); // Reload
      }
  };

  const handleDeleteAthlete = async (athleteId: string, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent selection
      if (window.confirm(`Are you sure you want to delete this athlete and ALL their data?`)) {
          deleteAthleteProfile(athleteId);
          await loadData(false);
          if (selectedAthleteId === athleteId) {
              setSelectedAthleteId('');
          }
      }
  };

  // --- Sorting Handlers (Drag & Drop) ---

  const handleDragStart = (index: number) => {
      setDraggedItemIndex(index);
  };

  const handleDragEnter = (index: number) => {
      if (draggedItemIndex === null || draggedItemIndex === index) return;
      
      const newAthletes = [...filteredAthletes];
      const draggedItem = newAthletes[draggedItemIndex];
      newAthletes.splice(draggedItemIndex, 1);
      newAthletes.splice(index, 0, draggedItem);
      
      const newOrderIds = newAthletes.map(a => a.id);
      const visibleIds = new Set(newOrderIds);
      const hiddenIds = athleteOrder.filter(id => !visibleIds.has(id));
      const finalOrder = [...newOrderIds, ...hiddenIds];
      
      setAthleteOrder(finalOrder);
      setDraggedItemIndex(index);
  };

  const handleDragEnd = () => {
      setDraggedItemIndex(null);
      saveAthleteOrder(athleteOrder);
  };

  // --- Note Saving (Single Cell) ---

  const handleNoteSave = async (record: AthleteData, text: string) => {
    setIsSyncingNote(true);
    saveNote(record.id, record.date, text);
    
    const newData = [...rawData];
    const idx = newData.findIndex(d => d.id === record.id && d.date === record.date);
    if (idx !== -1) {
        newData[idx] = { ...newData[idx], note: text };
        setRawData(newData);
    }
    
    const updatedRecord = { ...record, note: text };
    await backupToGoogleSheet(updatedRecord);
    
    setIsSyncingNote(false);
    setEditingNote(null);
  };

  const handleAthleteNoteSave = () => {
      if (selectedAthleteId) {
          setIsSavingNote(true);
          saveAthleteNote(selectedAthleteId, athleteNote);
          setTimeout(() => setIsSavingNote(false), 500);
      }
  };

  // --- Add Data Logic ---
  
  const handleOpenAddModal = () => {
      setNewEntryDate(new Date().toISOString().split('T')[0]);
      setNewEntryMetrics({});
      setIsAddModalOpen(true);
  };

  const handleNewEntryMetricChange = (key: string, value: string) => {
      setNewEntryMetrics(prev => ({
          ...prev,
          [key]: parseFloat(value) || 0
      }));
  };

  const handleSaveNewEntry = async (e: React.FormEvent) => {
      e.preventDefault();
      const currentAthlete = athletes.find(a => a.id === selectedAthleteId);
      if (!currentAthlete) return;

      setIsSavingNewEntry(true);

      const newRecord: AthleteData = {
          id: selectedAthleteId,
          name: currentAthlete.name,
          date: newEntryDate,
          jh: newEntryMetrics['jh'] || 0,
          avgPropulsiveForce: newEntryMetrics['avgPropulsiveForce'] || 0,
          peakPropulsiveForce: newEntryMetrics['peakPropulsiveForce'] || 0,
          peakPropulsivePower: newEntryMetrics['peakPropulsivePower'] || 0,
          propulsiveRfdSj: newEntryMetrics['propulsiveRfdSj'] || 0,
          mrsi: newEntryMetrics['mrsi'] || 0,
          timeToTakeoff: newEntryMetrics['timeToTakeoff'] || 0,
          brakingRfdCmj: newEntryMetrics['brakingRfdCmj'] || 0,
          rsiDj: newEntryMetrics['rsiDj'] || 0,
          lrPeakBrakingForceDiff: newEntryMetrics['lrPeakBrakingForceDiff'] || 0,
          note: '' // Note can be added via table later
      };

      addManualEntry(newRecord);
      await backupToGoogleSheet(newRecord);

      const newData = [...rawData];
      const existingIdx = newData.findIndex(d => d.id === newRecord.id && d.date === newRecord.date);
      if (existingIdx !== -1) {
          newData[existingIdx] = newRecord;
      } else {
          newData.push(newRecord);
          newData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      setRawData(newData);

      setIsSavingNewEntry(false);
      setIsAddModalOpen(false);
  };

  // --- Export ---

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;

    const currentName = athletes.find(a => a.id === selectedAthleteId)?.name || 'Athlete';
    
    const csvRows = [];
    csvRows.push(`Athlete Name,${currentName}`);
    csvRows.push(`Export Date,${new Date().toISOString().split('T')[0]}`);
    csvRows.push(`Profile Note,"${(athleteNote || '').replace(/"/g, '""')}"`);
    csvRows.push(''); 

    const headers = ['Date', ...METRICS.map(m => m.label), 'Daily Note'];
    csvRows.push(headers.join(','));

    [...filteredData].reverse().forEach(record => {
        const row = [
            record.date,
            ...METRICS.map(m => record[m.key] !== undefined ? record[m.key] : ''),
            `"${(record.note || '').replace(/"/g, '""')}"` 
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement("a");
    const safeName = currentName.replace(/[^a-z0-9]/gi, '_');
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `${safeName}_Full_Data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
      if (!contentRef.current) return;
      setIsExportingPdf(true);

      try {
          const element = contentRef.current;
          const canvas = await html2canvas(element, {
              backgroundColor: '#0f172a', 
              scale: 2, 
              useCORS: true,
              logging: false,
              height: element.scrollHeight,
              windowHeight: element.scrollHeight,
              ignoreElements: (el: any) => {
                  return el.classList.contains('no-export');
              },
              onclone: (documentClone: any) => {
                  const el = documentClone.querySelector('.export-container');
                  if (el) {
                      el.style.height = 'auto';
                      el.style.overflow = 'visible';
                  }
              }
          });

          const imgData = canvas.toDataURL('image/png');
          const { jsPDF } = window.jspdf;
          
          const pdfWidth = 210; 
          const pixelToMmRatio = 210 / canvas.width;
          const pdfHeight = canvas.height * pixelToMmRatio;

          const pdf = new jsPDF({
              orientation: 'p',
              unit: 'mm',
              format: [pdfWidth, pdfHeight]
          });
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

          const currentName = athletes.find(a => a.id === selectedAthleteId)?.name || 'Athlete';
          const safeName = currentName.replace(/[^a-z0-9]/gi, '_');
          pdf.save(`${safeName}_Report.pdf`);

      } catch (error) {
          console.error("PDF generation failed", error);
          alert("Failed to generate PDF report.");
      } finally {
          setIsExportingPdf(false);
      }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading Analysis...</div>;

  const currentRecord = filteredData[filteredData.length - 1];
  const previousRecord = filteredData[filteredData.length - 2];

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative">
      
      {/* Sidebar - Athlete List */}
      <div 
        className={`${isSidebarOpen ? 'w-full md:w-80 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0'} absolute lg:relative z-20 h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col`}
      >
          {/* Sidebar Header */}
          <div className={`p-4 border-b border-slate-800 flex flex-col gap-3 ${!isSidebarOpen && 'hidden lg:hidden'}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-white font-bold text-lg">Athletes</h3>
                <div className="flex items-center gap-2">
                    <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full font-mono">
                        {filteredAthletes.length}
                    </span>
                    <button 
                        onClick={() => setIsManageMode(!isManageMode)}
                        className={`p-1.5 rounded transition-colors ${isManageMode ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                        title={isManageMode ? "Finish Editing" : "Manage List"}
                    >
                        {isManageMode ? <Check className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
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
          
          {/* Athlete List with Drag & Drop */}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden ${!isSidebarOpen && 'hidden lg:hidden'}`}>
              {filteredAthletes.map((athlete, index) => (
                  <div
                      key={athlete.id}
                      draggable={isManageMode && !searchTerm} // Only drag if not searching
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => {
                          if (!isManageMode) {
                              setSelectedAthleteId(athlete.id);
                              // Auto close on mobile after selection
                              if (window.innerWidth < 1024) setIsSidebarOpen(false);
                          }
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-slate-800/30 hover:bg-slate-800/80 transition-all flex items-center gap-3 group relative cursor-pointer
                          ${selectedAthleteId === athlete.id && !isManageMode
                              ? 'bg-slate-800 border-l-4 border-l-primary-500' 
                              : 'border-l-4 border-l-transparent'
                          }
                          ${isManageMode ? 'cursor-grab active:cursor-grabbing' : ''}
                      `}
                  >
                      {isManageMode ? (
                          <GripVertical className="w-4 h-4 text-slate-600" />
                      ) : (
                          <div className={`
                              w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors
                              ${selectedAthleteId === athlete.id 
                                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
                                  : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300'
                              }
                          `}>
                              <User className="w-4 h-4" />
                          </div>
                      )}

                      <div className="truncate flex-1">
                        <span className={`font-medium block truncate ${selectedAthleteId === athlete.id && !isManageMode ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                            {athlete.name}
                        </span>
                      </div>

                      {isManageMode && (
                          <button 
                              onClick={(e) => handleDeleteAthlete(athlete.id, e)}
                              className="p-1.5 text-rose-500 hover:bg-rose-900/30 rounded"
                              title="Delete Athlete"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      )}
                  </div>
              ))}
              
              {filteredAthletes.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-sm">
                      No athletes found.
                  </div>
              )}
          </div>
      </div>

      {/* Toggle Button (Desktop & Mobile) */}
      <div className={`absolute z-30 top-4 transition-all duration-300 ${isSidebarOpen ? 'left-[calc(100%-2rem)] md:left-80' : 'left-0'}`}>
         <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             className="bg-slate-800 border border-slate-700 border-l-0 text-slate-400 hover:text-white hover:bg-slate-700 h-10 w-6 flex items-center justify-center rounded-r-lg shadow-md focus:outline-none no-export"
             title={isSidebarOpen ? "Collapse List" : "Expand List"}
         >
             {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
         </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950/50 relative">
         <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth export-container custom-scrollbar" ref={contentRef}>
            
            {/* Main Header / Filters */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8 pl-8 lg:pl-0">
                <div>
                     <h2 className="text-2xl font-bold text-white flex items-center gap-3 flex-wrap">
                        {currentRecord?.name || 'Select Athlete'}
                        {currentRecord && (
                            <span className="text-xs font-normal bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700">
                                ID: {currentRecord.id}
                            </span>
                        )}
                     </h2>
                     {currentRecord && (
                        <div className="flex items-center gap-3 mt-1">
                            <button 
                                onClick={() => loadData(false)}
                                disabled={syncing}
                                className="flex items-center text-xs text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                                {syncing ? 'Syncing...' : 'Manual Sync'}
                            </button>
                            <span className="text-xs text-slate-500">
                                (Last: {lastSynced.toLocaleTimeString()})
                            </span>
                        </div>
                     )}
                </div>
                
                <div className="flex flex-wrap items-center gap-2 lg:gap-3 w-full lg:w-auto">
                    {/* Add Data Button */}
                    {currentRecord && (
                        <button 
                            onClick={handleOpenAddModal}
                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors no-export shrink-0 shadow-lg shadow-primary-900/20"
                            title="Add Data Record"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Add Data</span>
                        </button>
                    )}

                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 shadow-sm no-export shrink-0 overflow-hidden">
                        <Calendar className="w-4 h-4 text-primary-500 shrink-0" />
                        <input 
                            type="date" 
                            className="bg-transparent text-white text-sm outline-none w-24 sm:w-28 lg:w-32 border-none focus:ring-0 p-0"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
                        />
                        <span className="text-slate-600">-</span>
                        <input 
                            type="date" 
                            className="bg-transparent text-white text-sm outline-none w-24 sm:w-28 lg:w-32 border-none focus:ring-0 p-0"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
                        />
                    </div>

                    {/* Export Buttons */}
                    {currentRecord && (
                        <>
                            <button 
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-700 transition-colors no-export shrink-0"
                                title="Download Full Data CSV"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                <span className="hidden sm:inline">CSV</span>
                            </button>
                            <button 
                                onClick={handleExportPDF}
                                disabled={isExportingPdf}
                                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-700 transition-colors no-export disabled:opacity-50 shrink-0"
                                title="Download Full Report PDF"
                            >
                                <Download className="w-4 h-4 text-rose-500" />
                                <span className="hidden sm:inline">{isExportingPdf ? '...' : 'PDF'}</span>
                            </button>
                        </>
                    )}
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
                            <div className="hidden sm:flex items-center gap-3 no-export text-xs text-slate-500">
                                <span>Edit directly to update local & cloud data</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto pb-2">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="bg-slate-950 text-slate-200 uppercase font-medium text-xs">
                                    <tr>
                                        <th className="px-4 py-3 sticky left-0 bg-slate-950 z-10 shadow-r min-w-[100px]">Date</th>
                                        {METRICS.map(m => (
                                            <th key={m.key} className="px-4 py-3 whitespace-nowrap min-w-[100px]" style={{ color: m.color }}>{m.label}</th>
                                        ))}
                                        <th className="px-4 py-3 min-w-[200px]">Coach Note</th>
                                        <th className="px-4 py-3 min-w-[80px] no-export text-center sticky right-0 bg-slate-950 z-10 shadow-l">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {[...filteredData].reverse().map((record) => {
                                        const recordKey = `${record.id}_${record.date}`;
                                        const isEditing = editingRow === recordKey;

                                        return (
                                            <tr key={recordKey} className={`hover:bg-slate-800/50 transition-colors group/row ${isEditing ? 'bg-slate-800/80' : ''}`}>
                                                <td className="px-4 py-3 font-mono sticky left-0 bg-slate-900 z-10 border-r border-slate-800 text-slate-300 font-medium shadow-r">
                                                    {record.date}
                                                </td>
                                                {METRICS.map(m => (
                                                    <td key={m.key} className="px-4 py-3 text-slate-300 tabular-nums">
                                                        {isEditing && editForm ? (
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                className="w-20 bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                                                value={editForm[m.key] || 0}
                                                                onChange={(e) => handleEditChange(m.key, e.target.value)}
                                                            />
                                                        ) : (
                                                            (record[m.key] as number).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3">
                                                    {isEditing && editForm ? (
                                                        <input 
                                                            className="bg-slate-950 border border-slate-600 rounded px-2 py-1 w-full text-white outline-none focus:border-primary-500 text-xs"
                                                            value={editForm.note || ''}
                                                            onChange={(e) => handleEditChange('note', e.target.value)}
                                                            placeholder="Add note..."
                                                        />
                                                    ) : (
                                                        /* Inline Quick Edit (Single Cell) Logic for non-edit mode */
                                                        editingNote?.id === record.id && editingNote?.date === record.date ? (
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
                                                                    {isSyncingNote ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div 
                                                                className="cursor-pointer hover:bg-slate-800 p-1.5 -m-1.5 rounded transition-colors group min-h-[24px] flex items-center"
                                                                onClick={() => setEditingNote({ id: record.id, date: record.date, text: record.note || '' })}
                                                                title="Click to add note quickly"
                                                            >
                                                                {record.note ? (
                                                                    <span className="text-slate-300 text-xs">{record.note}</span>
                                                                ) : (
                                                                    <span className="text-slate-700 text-xs italic group-hover:text-slate-500">+ Note</span>
                                                                )}
                                                            </div>
                                                        )
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center no-export sticky right-0 bg-slate-900 z-10 shadow-l border-l border-slate-800">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {isEditing ? (
                                                            <>
                                                                <button 
                                                                    onClick={handleSaveEdit}
                                                                    disabled={isSavingEdit}
                                                                    className="text-emerald-500 hover:text-emerald-400 p-1 rounded hover:bg-emerald-500/10 transition-colors"
                                                                    title="Save Changes"
                                                                >
                                                                    {isSavingEdit ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4" />}
                                                                </button>
                                                                <button 
                                                                    onClick={handleCancelEdit}
                                                                    disabled={isSavingEdit}
                                                                    className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
                                                                    title="Cancel"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button 
                                                                    onClick={() => handleStartEdit(record)}
                                                                    className="text-slate-500 hover:text-primary-400 p-1 rounded hover:bg-primary-500/10 transition-colors"
                                                                    title="Edit Record"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteRecord(record)}
                                                                    className="text-slate-600 hover:text-rose-500 transition-colors p-1 rounded hover:bg-rose-500/10"
                                                                    title="Delete Record"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
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
                                        : 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/20 no-export'
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

      {/* ADD DATA MODAL */}
      {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm no-export">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                      <div>
                          <h2 className="text-lg font-bold text-white flex items-center gap-2">
                             <Activity className="w-5 h-5 text-primary-500" />
                             Add Data Record
                          </h2>
                          <p className="text-xs text-slate-400">
                             Adding data for <span className="text-white font-medium">{athletes.find(a => a.id === selectedAthleteId)?.name}</span>
                          </p>
                      </div>
                      <button 
                          onClick={() => setIsAddModalOpen(false)}
                          className="text-slate-500 hover:text-white transition-colors"
                      >
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  {/* Modal Body (Scrollable) */}
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                       <form id="addDataForm" onSubmit={handleSaveNewEntry}>
                           <div className="mb-6">
                               <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                               <input 
                                   type="date" 
                                   required
                                   className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                                   value={newEntryDate}
                                   onChange={e => setNewEntryDate(e.target.value)}
                               />
                           </div>
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                               {/* Performance Column */}
                               <div>
                                   <h3 className="text-xs font-bold text-primary-500 uppercase tracking-wider mb-3 pb-1 border-b border-slate-800">
                                       Performance
                                   </h3>
                                   <div className="space-y-4">
                                       {METRICS.filter(m => m.category === 'performance').map(metric => (
                                           <div key={metric.key}>
                                               <label className="block text-xs text-slate-400 mb-1">{metric.label} ({metric.unit})</label>
                                               <input 
                                                   type="number" 
                                                   step="0.01" 
                                                   placeholder="0.00"
                                                   className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:border-primary-500 outline-none"
                                                   value={newEntryMetrics[metric.key] || ''}
                                                   onChange={(e) => handleNewEntryMetricChange(metric.key as string, e.target.value)}
                                               />
                                           </div>
                                       ))}
                                   </div>
                               </div>

                               {/* Injury Prevention Column */}
                               <div>
                                   <h3 className="text-xs font-bold text-accent-500 uppercase tracking-wider mb-3 pb-1 border-b border-slate-800">
                                       Injury Strategy
                                   </h3>
                                   <div className="space-y-4">
                                       {METRICS.filter(m => m.category === 'injury_prevention').map(metric => (
                                           <div key={metric.key}>
                                               <label className="block text-xs text-slate-400 mb-1">{metric.label} ({metric.unit})</label>
                                               <input 
                                                   type="number" 
                                                   step="0.01" 
                                                   placeholder="0.00"
                                                   className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:border-accent-500 outline-none"
                                                   value={newEntryMetrics[metric.key] || ''}
                                                   onChange={(e) => handleNewEntryMetricChange(metric.key as string, e.target.value)}
                                               />
                                           </div>
                                       ))}
                                   </div>
                               </div>
                           </div>
                       </form>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
                      <button 
                          type="button"
                          onClick={() => setIsAddModalOpen(false)}
                          className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-sm"
                      >
                          Cancel
                      </button>
                      <button 
                          type="submit"
                          form="addDataForm"
                          disabled={isSavingNewEntry}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2 rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                          {isSavingNewEntry ? 'Saving & Syncing...' : 'Save Record'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Analysis;