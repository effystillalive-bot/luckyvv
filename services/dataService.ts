import { AthleteData } from '../types';
import { MOCK_DATA_CSV } from '../constants';

const SETTINGS_KEY = 'proformance_settings_sheet_url';
const SCRIPT_URL_KEY = 'proformance_google_script_url'; 
const LOCAL_DATA_KEY = 'proformance_local_data';
const MANUAL_DATA_KEY = 'proformance_manual_data';
const NOTES_KEY = 'proformance_notes';
const ATHLETE_NOTES_KEY = 'proformance_athlete_notes';
const ATHLETE_ORDER_KEY = 'proformance_athlete_order'; // New key for sorting

// Declare XLSX globally as we load it via script tag
declare const XLSX: any;

// Helper: Convert Excel Serial Date to JS Date (YYYY-MM-DD)
const excelDateToJSDate = (serial: number): string => {
   const utc_days  = Math.floor(serial - 25569);
   const utc_value = utc_days * 86400;                                        
   const date_info = new Date(utc_value * 1000);
   return date_info.toISOString().split('T')[0];
}

// Helper to map a row (array of values) to AthleteData using a getter function for headers
const mapRowToAthlete = (getVal: (search: string) => string | null): AthleteData => {
  const name = getVal('name') || 'Unknown';
  // Attempt to standardize date format to YYYY-MM-DD
  let dateRaw = getVal('date');
  let date = dateRaw || new Date().toISOString().split('T')[0];
  
  // Check if date is Excel serial number (e.g. 45000)
  if (dateRaw && !dateRaw.includes('-') && !dateRaw.includes('/') && !isNaN(Number(dateRaw))) {
      date = excelDateToJSDate(Number(dateRaw));
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

// Generic File Parser (CSV, Excel, JSON)
export const parseFile = (file: File): Promise<AthleteData[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
        
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                let parsedData: AthleteData[] = [];

                if (isExcel) {
                    // Handle Excel
                    if (typeof XLSX === 'undefined') {
                        throw new Error("XLSX library not loaded. Please refresh.");
                    }
                    
                    // Read data as array for robustness
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }); 
                    
                    if (json.length > 0) {
                        const rows = json as any[][];
                        
                        // Smart Header Detection: Find the row that likely contains headers (contains 'name' and 'date' or 'jh')
                        let headerRowIndex = 0;
                        for(let i=0; i < Math.min(rows.length, 10); i++) {
                            const rowStr = rows[i].join(' ').toLowerCase();
                            if (rowStr.includes('name') && (rowStr.includes('date') || rowStr.includes('jh') || rowStr.includes('metric'))) {
                                headerRowIndex = i;
                                break;
                            }
                        }

                        const headers = (rows[headerRowIndex] as any[]).map(h => String(h));
                        const dataRows = rows.slice(headerRowIndex + 1);
                        
                        parsedData = dataRows.map((values) => {
                            const getVal = (search: string) => {
                                const idx = headers.findIndex(h => h.toLowerCase().includes(search.toLowerCase()));
                                return idx !== -1 && values[idx] !== undefined ? String(values[idx]).trim() : null;
                            };
                            return mapRowToAthlete(getVal);
                        }).filter(d => d.name && d.date && d.name !== 'Unknown');
                    }
                } else if (file.name.toLowerCase().endsWith('.json')) {
                    const textData = data as string;
                    let jsonData = JSON.parse(textData);
                    
                    // Handle wrapped JSON e.g. { data: [...] }
                    if (!Array.isArray(jsonData) && typeof jsonData === 'object') {
                        const possibleArray = Object.values(jsonData).find(val => Array.isArray(val));
                        if (possibleArray) {
                            jsonData = possibleArray;
                        }
                    }

                    if (Array.isArray(jsonData)) {
                        parsedData = jsonData.map((item: any) => {
                            const getVal = (key: string) => {
                                // Loose key matching
                                const foundKey = Object.keys(item).find(k => k.toLowerCase().includes(key.toLowerCase()));
                                return foundKey ? String(item[foundKey]) : null;
                            };
                            return mapRowToAthlete(getVal);
                        }).filter(d => d.name && d.date);
                    }
                } else {
                    // CSV
                    parsedData = parseCSV(data as string);
                }
                resolve(parsedData);
            } catch (err) {
                console.error("Parse error:", err);
                reject(err);
            }
        };

        if (isExcel) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
};

// Process uploaded file (CSV or Excel) for Settings (Overwrites Local Data)
export const processFile = async (file: File): Promise<void> => {
    const data = await parseFile(file);
    if (data.length > 0) {
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data));
    }
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

// --- Google Sheet Backup Integration ---

export const saveGoogleScriptUrl = (url: string) => {
    localStorage.setItem(SCRIPT_URL_KEY, url);
};

export const getGoogleScriptUrl = () => {
    return localStorage.getItem(SCRIPT_URL_KEY) || '';
};

export const backupToGoogleSheet = async (record: AthleteData): Promise<boolean> => {
    const scriptUrl = getGoogleScriptUrl();
    if (!scriptUrl) return false;

    try {
        // Send data as text/plain to avoid CORS preflight complications with GAS
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors', // 'no-cors' is often required for GAS Web Apps called from client-side
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify(record)
        });
        return true;
    } catch (error) {
        console.error("Backup to Google Sheet failed", error);
        return false;
    }
};

export const syncBatchToGoogleSheet = async (records: AthleteData[], onProgress?: (count: number) => void): Promise<void> => {
    const scriptUrl = getGoogleScriptUrl();
    if (!scriptUrl) return;

    for (let i = 0; i < records.length; i++) {
        await backupToGoogleSheet(records[i]);
        if (onProgress) onProgress(i + 1);
        // Small delay to be nice to GAS quotas and prevent 429 errors
        await new Promise(r => setTimeout(r, 500));
    }
};

// --- End Google Sheet Integration ---

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

// Batch Add Manual Entries (Merge logic)
export const batchAddManualEntries = (entries: AthleteData[]) => {
    const manualDataStr = localStorage.getItem(MANUAL_DATA_KEY);
    let manualData: AthleteData[] = manualDataStr ? JSON.parse(manualDataStr) : [];
    
    entries.forEach(entry => {
        const existingIndex = manualData.findIndex(d => d.id === entry.id && d.date === entry.date);
        if (existingIndex >= 0) {
            manualData[existingIndex] = entry; // Update
        } else {
            manualData.push(entry); // Insert
        }
    });
    
    localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(manualData));
};

export const getManualEntries = (): AthleteData[] => {
    const str = localStorage.getItem(MANUAL_DATA_KEY);
    return str ? JSON.parse(str) : [];
};

export const clearManualData = () => {
    localStorage.removeItem(MANUAL_DATA_KEY);
};

// --- Deletion & Sorting Features ---

export const deleteSpecificEntry = (athleteId: string, date: string) => {
    // 1. Remove from Local File Data
    const localDataStr = localStorage.getItem(LOCAL_DATA_KEY);
    if (localDataStr) {
        let localData: AthleteData[] = JSON.parse(localDataStr);
        localData = localData.filter(d => !(d.id === athleteId && d.date === date));
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(localData));
    }

    // 2. Remove from Manual Data
    const manualDataStr = localStorage.getItem(MANUAL_DATA_KEY);
    if (manualDataStr) {
        let manualData: AthleteData[] = JSON.parse(manualDataStr);
        manualData = manualData.filter(d => !(d.id === athleteId && d.date === date));
        localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(manualData));
    }
};

export const deleteAthleteProfile = (athleteId: string) => {
    // 1. Remove from Local Data
    const localDataStr = localStorage.getItem(LOCAL_DATA_KEY);
    if (localDataStr) {
        let localData: AthleteData[] = JSON.parse(localDataStr);
        localData = localData.filter(d => d.id !== athleteId);
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(localData));
    }

    // 2. Remove from Manual Data
    const manualDataStr = localStorage.getItem(MANUAL_DATA_KEY);
    if (manualDataStr) {
        let manualData: AthleteData[] = JSON.parse(manualDataStr);
        manualData = manualData.filter(d => d.id !== athleteId);
        localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(manualData));
    }

    // 3. Remove Notes
    const athleteNotes = getAthleteNotes();
    delete athleteNotes[athleteId];
    localStorage.setItem(ATHLETE_NOTES_KEY, JSON.stringify(athleteNotes));

    // 4. Remove from Sort Order
    let order = getAthleteOrder();
    order = order.filter(id => id !== athleteId);
    saveAthleteOrder(order);
};

export const saveAthleteOrder = (athleteIds: string[]) => {
    localStorage.setItem(ATHLETE_ORDER_KEY, JSON.stringify(athleteIds));
};

export const getAthleteOrder = (): string[] => {
    const str = localStorage.getItem(ATHLETE_ORDER_KEY);
    return str ? JSON.parse(str) : [];
};

// --- End Deletion & Sorting ---

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