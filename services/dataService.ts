import { AthleteData } from '../types';
import { MOCK_DATA_CSV } from '../constants';

const SETTINGS_KEY = 'proformance_settings_sheet_url';
const SCRIPT_URL_KEY = 'proformance_google_script_url'; 
const LOCAL_DATA_KEY = 'proformance_local_data';
const MANUAL_DATA_KEY = 'proformance_manual_data';
const NOTES_KEY = 'proformance_notes';
const ATHLETE_NOTES_KEY = 'proformance_athlete_notes';
const ATHLETE_ORDER_KEY = 'proformance_athlete_order';
const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwh9gkeMqsJQ_yfYABTBQGb1OE3RqLMfnzxmpJnvf_E_HyH7_jHuMD6zGb1m3JUM-I/exec';

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
    note: getVal('note') || getVal('notes') || '',
  };
};

// Helper to parse CSV string into objects
const parseCSV = (csvText: string): AthleteData[] => {
  // Security check: If response is HTML, it's likely a login page or 403 error
  if (!csvText || csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
      console.warn("CSV content appears to be HTML (likely login page or error).");
      return [];
  }

  // Robust CSV parsing using XLSX to handle quoted strings (e.g. "Note, with comma")
  if (typeof XLSX !== 'undefined') {
      try {
          const workbook = XLSX.read(csvText, { type: 'string' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          if (json.length > 0) {
              const rows = json as any[][];
              // Smart Header Detection
              let headerRowIndex = 0;
              for(let i=0; i < Math.min(rows.length, 10); i++) {
                 const rowStr = rows[i].join(' ').toLowerCase();
                 if (rowStr.includes('name') && (rowStr.includes('date') || rowStr.includes('jh'))) {
                     headerRowIndex = i;
                     break;
                 }
              }

              const headers = (rows[headerRowIndex] as any[]).map(h => String(h));
              const dataRows = rows.slice(headerRowIndex + 1);

              return dataRows.map((values) => {
                  const getVal = (search: string) => {
                      const idx = headers.findIndex(h => h.toLowerCase().includes(search.toLowerCase()));
                      return idx !== -1 && values[idx] !== undefined ? String(values[idx]).trim() : null;
                  };
                  return mapRowToAthlete(getVal);
              }).filter(d => d.name && d.date && d.name !== 'Unknown');
          }
      } catch (e) {
          console.error("XLSX parse error on CSV, falling back to simple split", e);
      }
  }

  // Fallback: Simple split (Fragile with quoted commas)
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map((line, index) => {
    const values = line.split(','); 
    if (values.length < 2) return null;

    const getVal = (search: string) => {
      const idx = headers.findIndex(h => h.toLowerCase().includes(search.toLowerCase()));
      return idx !== -1 ? values[idx]?.trim() : null;
    };

    return mapRowToAthlete(getVal);
  }).filter((d): d is AthleteData => d !== null && !!d.name && !!d.date && d.name !== 'Unknown');
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
                    if (typeof XLSX === 'undefined') {
                        throw new Error("XLSX library not loaded. Please refresh.");
                    }
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }); 
                    
                    if (json.length > 0) {
                        const rows = json as any[][];
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
                    if (!Array.isArray(jsonData) && typeof jsonData === 'object') {
                        const possibleArray = Object.values(jsonData).find(val => Array.isArray(val));
                        if (possibleArray) jsonData = possibleArray;
                    }

                    if (Array.isArray(jsonData)) {
                        parsedData = jsonData.map((item: any) => {
                            const getVal = (key: string) => {
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
    if (!url) return '';
    
    // 1. Check if it's already a publish-to-web CSV link
    if (url.includes('output=csv') || url.includes('format=csv')) return url;

    // 2. Extract Spreadsheet ID
    const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch || !idMatch[1]) return url;
    const id = idMatch[1];

    // 3. Extract GID (Sheet ID)
    let gid = '0';
    const queryGidMatch = url.match(/[?&]gid=([0-9]+)/);
    const hashGidMatch = url.match(/#gid=([0-9]+)/);

    if (queryGidMatch) {
        gid = queryGidMatch[1];
    } else if (hashGidMatch) {
        gid = hashGidMatch[1];
    }

    // Construct the export URL
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
};

// --- Google Sheet Backup Integration ---

export const saveGoogleScriptUrl = (url: string) => {
    localStorage.setItem(SCRIPT_URL_KEY, url);
};

export const getGoogleScriptUrl = () => {
    return localStorage.getItem(SCRIPT_URL_KEY) || DEFAULT_WEBHOOK_URL;
};

export const backupToGoogleSheet = async (record: AthleteData): Promise<boolean> => {
    const scriptUrl = getGoogleScriptUrl();
    if (!scriptUrl) return false;

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
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
        await new Promise(r => setTimeout(r, 500));
    }
};

// --- End Google Sheet Integration ---

// Manual Data Management
export const addManualEntry = (entry: AthleteData) => {
    const manualDataStr = localStorage.getItem(MANUAL_DATA_KEY);
    const manualData: AthleteData[] = manualDataStr ? JSON.parse(manualDataStr) : [];
    
    const existingIndex = manualData.findIndex(d => d.id === entry.id && d.date === entry.date);
    if (existingIndex >= 0) {
        manualData[existingIndex] = entry;
    } else {
        manualData.push(entry);
    }
    
    localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(manualData));
};

export const batchAddManualEntries = (entries: AthleteData[]) => {
    const manualDataStr = localStorage.getItem(MANUAL_DATA_KEY);
    let manualData: AthleteData[] = manualDataStr ? JSON.parse(manualDataStr) : [];
    
    entries.forEach(entry => {
        const existingIndex = manualData.findIndex(d => d.id === entry.id && d.date === entry.date);
        if (existingIndex >= 0) {
            manualData[existingIndex] = entry; 
        } else {
            manualData.push(entry); 
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
    const localDataStr = localStorage.getItem(LOCAL_DATA_KEY);
    if (localDataStr) {
        let localData: AthleteData[] = JSON.parse(localDataStr);
        localData = localData.filter(d => !(d.id === athleteId && d.date === date));
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(localData));
    }

    const manualDataStr = localStorage.getItem(MANUAL_DATA_KEY);
    if (manualDataStr) {
        let manualData: AthleteData[] = JSON.parse(manualDataStr);
        manualData = manualData.filter(d => !(d.id === athleteId && d.date === date));
        localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(manualData));
    }
};

export const deleteAthleteProfile = (athleteId: string) => {
    const localDataStr = localStorage.getItem(LOCAL_DATA_KEY);
    if (localDataStr) {
        let localData: AthleteData[] = JSON.parse(localDataStr);
        localData = localData.filter(d => d.id !== athleteId);
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(localData));
    }

    const manualDataStr = localStorage.getItem(MANUAL_DATA_KEY);
    if (manualDataStr) {
        let manualData: AthleteData[] = JSON.parse(manualDataStr);
        manualData = manualData.filter(d => d.id !== athleteId);
        localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(manualData));
    }

    const athleteNotes = getAthleteNotes();
    delete athleteNotes[athleteId];
    localStorage.setItem(ATHLETE_NOTES_KEY, JSON.stringify(athleteNotes));

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
            const separator = fetchUrl.includes('?') ? '&' : '?';
            const cacheBuster = `t=${new Date().getTime()}`;
            const finalUrl = `${fetchUrl}${separator}${cacheBuster}`;

            const response = await fetch(finalUrl);
            if (response.ok) {
                const text = await response.text();
                // Check if text is HTML (login page redirect or error)
                if (text.trim().startsWith('<')) {
                    console.warn(`Fetched data appears to be HTML. Likely a permission issue or invalid link.`);
                } else {
                    csvData = text;
                }
            } else {
                console.warn(`Failed to fetch Google Sheet: ${response.status}`);
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
  
  // Use a unique key that allows overrides. 
  // Base data first
  baseData.forEach(d => dataMap.set(`${d.id}_${d.date}`, d));
  // Manual data overrides if same ID and Date
  manualData.forEach(d => dataMap.set(`${d.id}_${d.date}`, d)); 
  
  const mergedData = Array.from(dataMap.values());
  const notes = getNotes();

  return mergedData.map(record => {
    const uniqueKey = `${record.id}_${record.date}`;
    // Prefer local note override, then record note, then empty
    return {
      ...record,
      note: notes[uniqueKey] || record.note || ''
    };
  });
};

export const testGoogleSheetConnection = async (url: string): Promise<{success: boolean, message: string, count: number}> => {
    if (!url) return { success: false, message: "No URL provided", count: 0 };
    
    try {
        const fetchUrl = convertToExportUrl(url);
        const cacheBuster = `t=${new Date().getTime()}`;
        const separator = fetchUrl.includes('?') ? '&' : '?';
        const finalUrl = `${fetchUrl}${separator}${cacheBuster}`;
        
        const response = await fetch(finalUrl);
        if (!response.ok) {
            return { success: false, message: `HTTP Error: ${response.status} ${response.statusText}`, count: 0 };
        }
        const text = await response.text();
        if (text.trim().startsWith('<')) {
             return { success: false, message: "Error: URL returned HTML. Please check 'Share' settings (Anyone with link).", count: 0 };
        }
        
        const data = parseCSV(text);
        if (data.length === 0) {
            return { success: false, message: "Connection successful, but found 0 valid athlete records.", count: 0 };
        }
        
        return { success: true, message: `Success! Found ${data.length} records.`, count: data.length };
    } catch (e: any) {
        return { success: false, message: `Fetch Error: ${e.message}`, count: 0 };
    }
}

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

export const saveAthleteNote = (athleteId: string, note: string) => {
    const notes = getAthleteNotes();
    notes[athleteId] = note;
    localStorage.setItem(ATHLETE_NOTES_KEY, JSON.stringify(notes));
};

export const getAthleteNotes = (): Record<string, string> => {
    const str = localStorage.getItem(ATHLETE_NOTES_KEY);
    return str ? JSON.parse(str) : {};
};