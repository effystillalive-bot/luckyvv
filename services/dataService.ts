import { AthleteData } from '../types';
import { MOCK_DATA_CSV } from '../constants';

const SETTINGS_KEY = 'proformance_settings_sheet_url';
const LOCAL_DATA_KEY = 'proformance_local_data';
const MANUAL_DATA_KEY = 'proformance_manual_data';
const NOTES_KEY = 'proformance_notes';
const ATHLETE_NOTES_KEY = 'proformance_athlete_notes';

// Declare XLSX globally as we load it via script tag
declare const XLSX: any;

// Helper to map a row (array of values) to AthleteData using a getter function for headers
const mapRowToAthlete = (getVal: (search: string) => string | null): AthleteData => {
  const name = getVal('name') || 'Unknown';
  // Attempt to standardize date format to YYYY-MM-DD
  let date = getVal('date') || new Date().toISOString().split('T')[0];
  
  // Simple check if date is Excel serial number (e.g. 45000)
  if (!date.includes('-') && !date.includes('/') && !isNaN(Number(date))) {
     // If needed, we could implement excel date conversion here, skipping for now
  }

  return {
    id: `${name.replace(/\s+/g, '-').toLowerCase()}`,
    name: name,
    date: date,
    jh: parseFloat(getVal('jh') || '0'),
    avgPropulsiveForce: parseFloat(getVal('avg propulsive force') || '0'),
    mrsi: parseFloat(getVal('mrsi') || '0'),
    timeToTakeoff: parseFloat(getVal('time to takeoff') || '0'),
    propulsiveRfdSj: parseFloat(getVal('propulsive rfd') || '0'),
    brakingRfdCmj: parseFloat(getVal('braking rfd') || '0'),
    rsiDj: parseFloat(getVal('rsi (dj)') || '0'),
    peakPropulsivePower: parseFloat(getVal('power') || '0'),
    peakPropulsiveForce: parseFloat(getVal('peak propulsive force') || '0'),
    lrPeakBrakingForceDiff: parseFloat(getVal('asym') || '0'),
  };
};

// Helper to parse CSV string into objects
const parseCSV = (csvText: string): AthleteData[] => {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map((line, index) => {
    // Handle potential CSV quoting issues simply for now
    const values = line.split(','); 
    
    const getVal = (search: string) => {
      const idx = headers.findIndex(h => h.toLowerCase().includes(search.toLowerCase()));
      return idx !== -1 ? values[idx]?.trim() : null;
    };

    return mapRowToAthlete(getVal);
  }).filter(d => d.name && d.date && d.name !== 'Unknown');
};

// Process uploaded file (CSV or Excel)
export const processFile = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let parsedData: AthleteData[] = [];

        if (file.name.toLowerCase().endsWith('.csv')) {
           parsedData = parseCSV(data as string);
        } else {
           // Handle Excel
           if (typeof XLSX === 'undefined') {
             throw new Error("XLSX library not loaded. Please refresh.");
           }
           const workbook = XLSX.read(data, { type: 'binary' });
           const sheetName = workbook.SheetNames[0];
           const sheet = workbook.Sheets[sheetName];
           // header: 1 returns array of arrays [ ['Name', 'Date'], ['John', '2023...'] ]
           const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }); 
           
           if (json.length > 1) {
             const headers = (json[0] as any[]).map(h => String(h));
             const rows = json.slice(1) as any[][];
             
             parsedData = rows.map((values) => {
                const getVal = (search: string) => {
                    const idx = headers.findIndex(h => h.toLowerCase().includes(search.toLowerCase()));
                    return idx !== -1 && values[idx] !== undefined ? String(values[idx]).trim() : null;
                };
                return mapRowToAthlete(getVal);
             }).filter(d => d.name && d.date && d.name !== 'Unknown');
           }
        }
        
        if (parsedData.length > 0) {
            localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(parsedData));
        }
        resolve();
      } catch (err) {
        console.error("File processing error", err);
        reject(err);
      }
    };

    if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
  });
};

export const clearLocalData = () => {
  localStorage.removeItem(LOCAL_DATA_KEY);
};

// Helper to convert Google Sheet URL to CSV Export URL
const convertToExportUrl = (url: string): string => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    }
    return url;
};

// Manual Data Management
export const addManualEntry = (entry: AthleteData) => {
    const manualDataStr = localStorage.getItem(MANUAL_DATA_KEY);
    const manualData: AthleteData[] = manualDataStr ? JSON.parse(manualDataStr) : [];
    
    // Check if entry exists (same ID and Date) and update it, or append new
    const existingIndex = manualData.findIndex(d => d.id === entry.id && d.date === entry.date);
    if (existingIndex >= 0) {
        manualData[existingIndex] = entry;
    } else {
        manualData.push(entry);
    }
    
    localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(manualData));
};

export const getManualEntries = (): AthleteData[] => {
    const str = localStorage.getItem(MANUAL_DATA_KEY);
    return str ? JSON.parse(str) : [];
};

export const clearManualData = () => {
    localStorage.removeItem(MANUAL_DATA_KEY);
};

export const fetchData = async (): Promise<AthleteData[]> => {
  let baseData: AthleteData[] = [];

  // 1. Priority: Local File Data
  const localDataStr = localStorage.getItem(LOCAL_DATA_KEY);
  if (localDataStr) {
      try {
        baseData = JSON.parse(localDataStr);
      } catch (e) {
          console.error("Failed to parse local data", e);
      }
  } else {
    // 2. Priority: Google Sheet URL
    let sheetUrl = localStorage.getItem(SETTINGS_KEY);
    let csvData = MOCK_DATA_CSV;

    if (sheetUrl && sheetUrl.includes('google.com/spreadsheets')) {
        try {
        const fetchUrl = convertToExportUrl(sheetUrl);
        const response = await fetch(fetchUrl);
        if (response.ok) {
            csvData = await response.text();
        } else {
            console.error("Failed to fetch Google Sheet.");
        }
        } catch (error) {
        console.error("Error fetching Google Sheet:", error);
        }
    }
    baseData = parseCSV(csvData);
  }

  // 3. Merge with Manual Data
  const manualData = getManualEntries();
  
  // Combine datasets. If duplicates exist (same ID + Date), manual data typically overrides or is just appended.
  // For simplicity and clarity in charts, let's treat manual data as "correction" or "addition".
  // We will map by ID_DATE key to ensure uniqueness if that's desired, or just concat.
  // Let's concat, but if there's an exact duplicate, the chart might look weird. 
  // Let's prioritize manual data if date matches.
  
  const dataMap = new Map<string, AthleteData>();
  
  baseData.forEach(d => dataMap.set(`${d.id}_${d.date}`, d));
  manualData.forEach(d => dataMap.set(`${d.id}_${d.date}`, d)); // Manual overrides
  
  const mergedData = Array.from(dataMap.values());
  const notes = getNotes();

  return mergedData.map(record => {
    const uniqueKey = `${record.id}_${record.date}`;
    return {
      ...record,
      note: notes[uniqueKey] || record.note || ''
    };
  });
};

export const saveSheetUrl = (url: string) => {
  localStorage.setItem(SETTINGS_KEY, url);
};

export const getSheetUrl = () => {
  return localStorage.getItem(SETTINGS_KEY) || '';
};

export const getDataSourceType = () => {
    if (localStorage.getItem(LOCAL_DATA_KEY)) return 'local_file';
    if (localStorage.getItem(SETTINGS_KEY)) return 'google_sheet';
    return 'demo';
};

// Notes Management
export const saveNote = (athleteId: string, date: string, note: string) => {
  const notes = getNotes();
  const key = `${athleteId}_${date}`;
  if (note.trim() === '') {
    delete notes[key];
  } else {
    notes[key] = note;
  }
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
};

export const getNotes = (): Record<string, string> => {
  const str = localStorage.getItem(NOTES_KEY);
  return str ? JSON.parse(str) : {};
};

// General Athlete Notes (Profile level)
export const saveAthleteNote = (athleteId: string, note: string) => {
    const notes = getAthleteNotes();
    notes[athleteId] = note;
    localStorage.setItem(ATHLETE_NOTES_KEY, JSON.stringify(notes));
};

export const getAthleteNotes = (): Record<string, string> => {
    const str = localStorage.getItem(ATHLETE_NOTES_KEY);
    return str ? JSON.parse(str) : {};
};