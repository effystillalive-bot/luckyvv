import { AthleteData } from '../types';
import { MOCK_DATA_CSV } from '../constants';

const SETTINGS_KEY = 'proformance_settings_sheet_url';
const SCRIPT_URL_KEY = 'proformance_google_script_url'; 
const LOCAL_DATA_KEY = 'proformance_local_data';
const MANUAL_DATA_KEY = 'proformance_manual_data';
const DELETED_DATA_KEY = 'proformance_deleted_data'; // New: Track deleted rows
const BLOCKED_ATHLETES_KEY = 'proformance_blocked_athletes'; // New: Track deleted athletes
const NOTES_KEY = 'proformance_notes';
const ATHLETE_NOTES_KEY = 'proformance_athlete_notes';
const ATHLETE_ORDER_KEY = 'proformance_athlete_order';
const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwh9gkeMqsJQ_yfYABTBQGb1OE3RqLMfnzxmpJnvf_E_HyH7_jHuMD6zGb1m3JUM-I/exec';
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1476xvdLdcXzAyQio2WsXuii8ailSk7PNKfR_iLmu0WA/edit?gid=0#gid=0';

declare const XLSX: any;

const excelDateToJSDate = (serial: number): string => {
   const utc_days  = Math.floor(serial - 25569);
   const utc_value = utc_days * 86400;                                        
   const date_info = new Date(utc_value * 1000);
   return date_info.toISOString().split('T')[0];
}

const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    if (!dateStr.includes('-') && !dateStr.includes('/') && !isNaN(Number(dateStr))) {
        return excelDateToJSDate(Number(dateStr));
    }
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        // Handle YYYY/MM/DD
        if (parts[0].length === 4) {
             return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
    }
    return dateStr;
};

const mapRowToAthlete = (getVal: (search: string[]) => string | null, nameFallback: string | null): AthleteData => {
  const name = getVal(['name', '姓名', 'athlete']) || nameFallback || 'Unknown';
  let dateRaw = getVal(['date', '日期', 'time']);
  let date = normalizeDate(dateRaw || '');

  const getNum = (keys: string[]) => parseFloat(getVal(keys) || '0');

  return {
    id: `${name.replace(/\s+/g, '-').toLowerCase()}`,
    name: name,
    date: date,
    jh: getNum(['jh', 'jump height', '跳躍高度']),
    avgPropulsiveForce: getNum(['avg propulsive force', '平均推進力']),
    mrsi: getNum(['mrsi', 'modified rsi']),
    timeToTakeoff: getNum(['time to takeoff', '起跳時間']),
    propulsiveRfdSj: getNum(['propulsive rfd', '推進率']),
    brakingRfdCmj: getNum(['braking rfd', '煞車率']),
    rsiDj: getNum(['rsi (dj)', 'rsi']),
    peakPropulsivePower: getNum(['power', '功率']),
    peakPropulsiveForce: getNum(['peak propulsive force', '最大推進力']),
    lrPeakBrakingForceDiff: getNum(['asym', '不對稱', 'diff']),
    note: getVal(['note', 'notes', '備註']) || '',
  };
};

const parseCSV = (csvText: string): AthleteData[] => {
  if (!csvText || csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
      return [];
  }

  if (typeof XLSX !== 'undefined') {
      try {
          const workbook = XLSX.read(csvText, { type: 'string' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          if (json.length > 0) {
              const rows = json as any[][];
              let headerRowIndex = 0;
              for(let i=0; i < Math.min(rows.length, 10); i++) {
                 const rowStr = rows[i].join(' ').toLowerCase();
                 if (rowStr.includes('date') || rowStr.includes('日期') || rowStr.includes('jh') || rowStr.includes('jump')) {
                     headerRowIndex = i;
                     break;
                 }
              }

              const headers = (rows[headerRowIndex] as any[]).map(h => String(h).trim());
              const dataRows = rows.slice(headerRowIndex + 1);

              return dataRows.map((values) => {
                  const getVal = (searchKeys: string[]) => {
                      const idx = headers.findIndex(h => 
                          searchKeys.some(key => h.toLowerCase().includes(key.toLowerCase()))
                      );
                      return idx !== -1 && values[idx] !== undefined ? String(values[idx]).trim() : null;
                  };

                  let nameFallback = null;
                  const nameHeaderExists = headers.some(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('姓名'));
                  if (!nameHeaderExists && values[0]) {
                      nameFallback = String(values[0]).trim();
                  }

                  return mapRowToAthlete(getVal, nameFallback);
              }).filter(d => d.name && d.date && d.name !== 'Unknown' && d.name.trim() !== '');
          }
      } catch (e) {
          console.error("XLSX parse error on CSV", e);
      }
  }
  return [];
};

export const parseFile = (file: File): Promise<AthleteData[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
        
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                let parsedData: AthleteData[] = [];
                if (!isExcel) {
                    parsedData = parseCSV(data as string);
                } else {
                     if (typeof XLSX === 'undefined') throw new Error("XLSX lib missing");
                     const workbook = XLSX.read(data, { type: 'array' });
                     const sheet = workbook.Sheets[workbook.SheetNames[0]];
                     const csv = XLSX.utils.sheet_to_csv(sheet);
                     parsedData = parseCSV(csv);
                }
                resolve(parsedData);
            } catch (err) {
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

const convertToExportUrl = (url: string): string => {
    if (!url) return '';
    if (url.includes('tqx=out:csv')) return url;
    const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch || !idMatch[1]) return url;
    const id = idMatch[1];
    let gid = '0';
    const queryGidMatch = url.match(/[?&]gid=([0-9]+)/);
    const hashGidMatch = url.match(/#gid=([0-9]+)/);
    if (queryGidMatch) gid = queryGidMatch[1];
    else if (hashGidMatch) gid = hashGidMatch[1];
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;
};

export const saveGoogleScriptUrl = (url: string) => {
    localStorage.setItem(SCRIPT_URL_KEY, url);
};

export const getGoogleScriptUrl = () => {
    return localStorage.getItem(SCRIPT_URL_KEY) || DEFAULT_WEBHOOK_URL;
};

export const backupToGoogleSheet = async (record: AthleteData): Promise<boolean> => {
    const scriptUrl = getGoogleScriptUrl();
    if (!scriptUrl) return false;
    // Basic sanitization to prevent sending empty objects that might confuse some scripts
    if (!record.name || !record.date) return false;

    try {
        const cleanRecord = JSON.parse(JSON.stringify(record));
        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(cleanRecord)
        });
        return true;
    } catch (error) {
        console.error("Backup to Google Sheet failed", error);
        return false;
    }
};

export const syncBatchToGoogleSheet = async (records: AthleteData[], onProgress?: (count: number) => void): Promise<void> => {
    for (let i = 0; i < records.length; i++) {
        await backupToGoogleSheet(records[i]);
        if (onProgress) onProgress(i + 1);
        await new Promise(r => setTimeout(r, 600)); 
    }
};

export const checkSyncStatus = (): { read: boolean, write: boolean } => {
    const readUrl = localStorage.getItem(SETTINGS_KEY) || DEFAULT_SHEET_URL;
    const writeUrl = getGoogleScriptUrl();
    return {
        read: !!(readUrl && readUrl.includes('google.com/spreadsheets')),
        write: !!(writeUrl && writeUrl.startsWith('http'))
    };
};

export const getManualEntries = (): AthleteData[] => {
    const str = localStorage.getItem(MANUAL_DATA_KEY);
    return str ? JSON.parse(str) : [];
};

export const addManualEntry = (entry: AthleteData) => {
    const current = getManualEntries();
    const filtered = current.filter(d => !(d.id === entry.id && d.date === entry.date));
    filtered.push(entry);
    localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(filtered));
    
    // If we are adding back an entry that was previously deleted, remove it from the deleted list
    const deleted = getDeletedEntries();
    const newDeleted = deleted.filter(d => !(d.id === entry.id && d.date === entry.date));
    localStorage.setItem(DELETED_DATA_KEY, JSON.stringify(newDeleted));
};

export const batchAddManualEntries = (entries: AthleteData[]) => {
    const current = getManualEntries();
    const currentMap = new Map<string, AthleteData>();
    current.forEach(d => currentMap.set(`${d.id}_${d.date}`, d));
    
    entries.forEach(d => {
        currentMap.set(`${d.id}_${d.date}`, d);
    });
    
    const merged = Array.from(currentMap.values());
    localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(merged));
};

export const clearManualData = () => {
    localStorage.removeItem(MANUAL_DATA_KEY);
};

// --- Deletion Logic with Soft Deletes (Tombstones) ---

export const getDeletedEntries = (): {id: string, date: string}[] => {
    const str = localStorage.getItem(DELETED_DATA_KEY);
    return str ? JSON.parse(str) : [];
}

export const getBlockedAthletes = (): string[] => {
    const str = localStorage.getItem(BLOCKED_ATHLETES_KEY);
    return str ? JSON.parse(str) : [];
}

export const deleteSpecificEntry = (id: string, date: string) => {
    // 1. Remove from Manual (override)
    const current = getManualEntries();
    const filtered = current.filter(d => !(d.id === id && d.date === date));
    localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(filtered));
    
    // 2. Remove from Local File Data (if uploaded)
    const localDataStr = localStorage.getItem(LOCAL_DATA_KEY);
    if (localDataStr) {
        let localData = JSON.parse(localDataStr) as AthleteData[];
        localData = localData.filter(d => !(d.id === id && d.date === date));
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(localData));
    }

    // 3. Mark as Deleted (Soft Delete) to hide from Google Sheet data
    const deleted = getDeletedEntries();
    if (!deleted.some(d => d.id === id && d.date === date)) {
        deleted.push({ id, date });
        localStorage.setItem(DELETED_DATA_KEY, JSON.stringify(deleted));
    }
};

export const deleteAthleteProfile = (id: string) => {
    // 1. Remove from Manual Data
    const currentManual = getManualEntries();
    const filteredManual = currentManual.filter(d => d.id !== id);
    localStorage.setItem(MANUAL_DATA_KEY, JSON.stringify(filteredManual));

    // 2. Remove from Local File Data
    const localDataStr = localStorage.getItem(LOCAL_DATA_KEY);
    if (localDataStr) {
        let localData = JSON.parse(localDataStr) as AthleteData[];
        localData = localData.filter(d => d.id !== id);
        localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(localData));
    }

    // 3. Remove Notes
    const notes = getNotes();
    Object.keys(notes).forEach(key => {
        if (key.startsWith(`${id}_`)) delete notes[key];
    });
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

    // 4. Remove Athlete Note
    const athleteNotes = getAthleteNotes();
    if (athleteNotes[id]) {
        delete athleteNotes[id];
        localStorage.setItem(ATHLETE_NOTES_KEY, JSON.stringify(athleteNotes));
    }
    
    // 5. Remove from Order
    const order = getAthleteOrder();
    const newOrder = order.filter(oid => oid !== id);
    saveAthleteOrder(newOrder);

    // 6. Block Athlete (Soft Delete for Sheet Data)
    const blocked = getBlockedAthletes();
    if (!blocked.includes(id)) {
        blocked.push(id);
        localStorage.setItem(BLOCKED_ATHLETES_KEY, JSON.stringify(blocked));
    }
};

export const saveAthleteOrder = (order: string[]) => {
    localStorage.setItem(ATHLETE_ORDER_KEY, JSON.stringify(order));
};

export const getAthleteOrder = (): string[] => {
    const str = localStorage.getItem(ATHLETE_ORDER_KEY);
    return str ? JSON.parse(str) : [];
};

export const fetchData = async (): Promise<AthleteData[]> => {
  let baseData: AthleteData[] = [];
  
  const userSettingUrl = localStorage.getItem(SETTINGS_KEY);
  const targetUrl = userSettingUrl || DEFAULT_SHEET_URL;

  let sheetLoaded = false;

  if (targetUrl) {
      try {
          const fetchUrl = convertToExportUrl(targetUrl);
          const separator = fetchUrl.includes('?') ? '&' : '?';
          const finalUrl = `${fetchUrl}${separator}t=${new Date().getTime()}`;
          
          const response = await fetch(finalUrl);
          if (response.ok) {
              const text = await response.text();
              if (!text.trim().startsWith('<')) {
                  const parsed = parseCSV(text);
                  if (parsed.length > 0) {
                      baseData = parsed;
                      sheetLoaded = true;
                  }
              }
          }
      } catch (error) {
          console.error("Google Sheet Fetch Error:", error);
      }
  }

  if (!sheetLoaded) {
      const localDataStr = localStorage.getItem(LOCAL_DATA_KEY);
      if (localDataStr) {
          try { baseData = JSON.parse(localDataStr); } catch (e) {}
      }
  }
  
  if (baseData.length === 0 && !sheetLoaded) {
      baseData = parseCSV(MOCK_DATA_CSV);
  }

  // Merge Data
  const manualData = getManualEntries();
  const dataMap = new Map<string, AthleteData>();
  
  baseData.forEach(d => dataMap.set(`${d.id}_${d.date}`, d));
  manualData.forEach(d => dataMap.set(`${d.id}_${d.date}`, d)); 
  
  // Filter out Deleted Data
  const deletedEntries = getDeletedEntries();
  const blockedAthletes = getBlockedAthletes();
  
  const notes = getNotes();

  return Array.from(dataMap.values())
    .filter(record => {
        // Check if athlete is blocked
        if (blockedAthletes.includes(record.id)) return false;
        // Check if specific row is deleted
        if (deletedEntries.some(del => del.id === record.id && del.date === record.date)) return false;
        return true;
    })
    .map(record => {
        const uniqueKey = `${record.id}_${record.date}`;
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
        const finalUrl = `${fetchUrl}&t=${new Date().getTime()}`;
        const response = await fetch(finalUrl);
        if (!response.ok) return { success: false, message: `HTTP Error: ${response.status}`, count: 0 };
        const text = await response.text();
        if (text.trim().startsWith('<')) return { success: false, message: "URL returned HTML. Check permissions.", count: 0 };
        const data = parseCSV(text);
        if (data.length === 0) return { success: false, message: "Connection OK but 0 valid records found. Check columns.", count: 0 };
        return { success: true, message: `Success! Found ${data.length} records.`, count: data.length };
    } catch (e: any) {
        return { success: false, message: `Fetch Error: ${e.message}`, count: 0 };
    }
}

export const saveSheetUrl = (url: string) => { localStorage.setItem(SETTINGS_KEY, url); };
export const getSheetUrl = () => { return localStorage.getItem(SETTINGS_KEY) || DEFAULT_SHEET_URL; };
export const getDataSourceType = () => {
    if (localStorage.getItem(SETTINGS_KEY) || DEFAULT_SHEET_URL) return 'google_sheet';
    if (localStorage.getItem(LOCAL_DATA_KEY)) return 'local_file';
    return 'demo';
};
export const saveNote = (athleteId: string, date: string, note: string) => {
  const notes = getNotes();
  const key = `${athleteId}_${date}`;
  if (note.trim() === '') delete notes[key]; else notes[key] = note;
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