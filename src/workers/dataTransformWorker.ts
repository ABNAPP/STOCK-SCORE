/**
 * Data Transform Worker
 * 
 * Web Worker for transforming data from Google Sheets.
 * Runs transformations in a separate thread to avoid blocking the main UI thread.
 * 
 * This file contains inline copies of transformer functions and helper utilities
 * since Web Workers cannot easily import modules.
 */

// ============================================================================
// Type Definitions (inline copies)
// ============================================================================

type DataRow = Record<string, string | number | undefined>;

interface TransformMessage {
  type: 'transform';
  transformerId: string;
  data: DataRow[];
  meta: { fields: string[] | null };
  jobId: string;
  // For ScoreBoard transformer, include external data
  industryPe1Map?: Record<string, number>;
  industryPe2Map?: Record<string, number>;
  smaDataMap?: Record<string, { sma100: number | null; sma200: number | null; smaCross: string | null }>;
  // For Threshold Industry transformer, include industry maps
  industryIRRMap?: Record<string, number>;
  industryLeverageF2Map?: Record<string, { greenMax: number; redMin: number }>;
  industryRO40Map?: Record<string, { min: number; max: number }>;
  industryCashSdebtMap?: Record<string, { min: number; max: number }>;
  industryCurrentRatioMap?: Record<string, { min: number; max: number }>;
}

interface ProgressMessage {
  type: 'progress';
  jobId: string;
  stage: 'transform';
  percentage: number;
  message: string;
  rowsProcessed?: number;
  totalRows?: number;
}

interface CompleteMessage {
  type: 'complete';
  jobId: string;
  data: unknown[];
}

interface ErrorMessage {
  type: 'error';
  jobId: string;
  error: string;
}

// ============================================================================
// Helper Functions (inline copies from dataTransformers.ts)
// ============================================================================

function getValue(possibleNames: string[], row: DataRow): string {
  if (!row || typeof row !== 'object') {
    return '';
  }
  
  for (const name of possibleNames) {
    if (typeof name !== 'string') continue;
    
    // Try exact match first
    const value = row[name];
    if (value !== undefined && value !== null && value !== '') {
      return String(value).trim();
    }
    // Try case-insensitive match
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerName) {
        const val = row[key];
        if (val !== undefined && val !== null && val !== '') {
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

function getValueAllowZero(possibleNames: string[], row: DataRow): string {
  for (const name of possibleNames) {
    // Try exact match first
    if (row[name] !== undefined && row[name] !== null) {
      const value = row[name];
      // If value is 0 (number or string "0"), return "0"
      if (value === 0 || value === '0') {
        return '0';
      }
      // If value is empty string, skip
      if (value === '') {
        continue;
      }
      return String(value).trim();
    }
    // Try case-insensitive match
    const lowerName = name.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === lowerName) {
        const value = row[key];
        // Allow 0 as a valid value
        if (value !== undefined && value !== null) {
          // If value is 0 (number or string "0"), return "0"
          if (value === 0 || value === '0') {
            return '0';
          }
          // If value is empty string, skip
          if (value === '') {
            continue;
          }
          return String(value).trim();
        }
      }
    }
  }
  return '';
}

function isValidValue(value: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return normalized !== '#N/A' && normalized !== 'N/A' && normalized !== '#NUM!' && normalized !== '#VALUE!' && normalized !== '#DIV/0!' && normalized !== '#REF!' && normalized !== 'LOADING...';
}

function parseNumericValueNullable(valueStr: string): number | null {
  if (typeof valueStr !== 'string' || !isValidValue(valueStr)) return null;
  
  // Remove common prefixes and clean the string
  let cleaned = String(valueStr)
    .replace(/,/g, '.')
    .replace(/\s/g, '')
    .replace(/#/g, '')
    .replace(/%/g, '')
    .replace(/\$/g, '');
  
  const parsed = parseFloat(cleaned);
  if (typeof parsed !== 'number' || isNaN(parsed) || !isFinite(parsed)) return null;
  
  return parsed;
}

function parsePercentageValueNullable(valueStr: string): number | null {
  if (typeof valueStr !== 'string' || !isValidValue(valueStr)) return null;
  
  // Remove % sign and clean the string
  let cleaned = String(valueStr)
    .replace(/,/g, '.')
    .replace(/\s/g, '')
    .replace(/#/g, '')
    .replace(/%/g, '')
    .replace(/\$/g, '');
  
  const parsed = parseFloat(cleaned);
  if (typeof parsed !== 'number' || isNaN(parsed) || !isFinite(parsed)) return null;
  
  return parsed;
}

function calculateMedian(values: number[]): number | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  
  // Filter out invalid numbers
  const validNumbers = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
  if (validNumbers.length === 0) return null;
  
  const sorted = [...validNumbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

// Industry threshold lookup functions (simplified - we'll pass the maps if needed)
// For Threshold Industry transformer, we'll need to pass the maps as data

// ============================================================================
// Transformer Functions (inline copies)
// ============================================================================

function transformBenjaminGrahamData(results: { data: DataRow[]; meta: { fields: string[] | null } }): unknown[] {
  const benjaminGrahamData = results.data
    .map((row: DataRow) => {
      const companyName = getValue(['Company Name', 'Company', 'company'], row);
      const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
      const priceStr = getValue(['Price', 'price', 'PRICE'], row);
      const benjaminGrahamStr = getValue(['Benjamin Graham', 'benjamin graham', 'Benjamin', 'benjamin'], row);
      
      // Only process if company name is valid (not #N/A)
      if (!isValidValue(companyName)) {
        return null;
      }
      
      // Filter out rows where Ticker is N/A
      if (!isValidValue(ticker)) {
        return null;
      }
      
      // Parse Price value as number (handle #N/A)
      const price = parseNumericValueNullable(priceStr);
      
      // Parse Benjamin Graham value as number (handle #N/A)
      const benjaminGraham = parseNumericValueNullable(benjaminGrahamStr);
      
      // Parse IV (FCF) if it exists
      const ivFcfStr = getValue(['IV (FCF)', 'IV(FCF)', 'iv fcf', 'ivfcf'], row);
      const ivFcf = parseNumericValueNullable(ivFcfStr);
      
      // Parse IRR1 if it exists
      const irr1Str = getValue(['IRR1', 'irr1', 'IRR 1', 'irr 1'], row);
      const irr1 = parseNumericValueNullable(irr1Str);
      
      return {
        companyName: companyName,
        ticker: ticker,
        price: price,
        benjaminGraham: benjaminGraham,
        ivFcf: ivFcf,
        irr1: irr1,
      };
    })
    .filter((data) => data !== null);
  
  return benjaminGrahamData;
}

function transformPEIndustryData(results: { data: DataRow[]; meta: { fields: string[] | null } }): unknown[] {
  // Group data by industry
  const industryMap = new Map<string, { pe: number[]; pe1: number[]; pe2: number[]; count: number }>();

  results.data.forEach((row: DataRow) => {
    const companyName = getValue(['Company Name', 'Company', 'company'], row);
    const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
    const industry = getValue(['INDUSTRY', 'Industry', 'industry'], row);
    
    // Filter out rows where Company Name, Ticker, or Industry is N/A
    if (!isValidValue(companyName) || !isValidValue(ticker) || !isValidValue(industry)) {
      return;
    }

    const peStr = getValue(['P/E', 'P/E', 'pe', 'PE'], row);
    const pe1Str = getValue(['P/E1', 'P/E 1', 'pe1', 'PE1'], row);
    const pe2Str = getValue(['P/E2', 'P/E 2', 'pe2', 'PE2'], row);

    let industryData = industryMap.get(industry);
    if (!industryData) {
      industryData = { pe: [], pe1: [], pe2: [], count: 0 };
      industryMap.set(industry, industryData);
    }
    industryData.count++;

    const pe = parseNumericValueNullable(peStr);
    const pe1 = parseNumericValueNullable(pe1Str);
    const pe2 = parseNumericValueNullable(pe2Str);

    // Include 0 values (actual zeros) but exclude null (invalid/missing)
    if (pe !== null) {
      industryData.pe.push(pe);
    }
    if (pe1 !== null) {
      industryData.pe1.push(pe1);
    }
    if (pe2 !== null) {
      industryData.pe2.push(pe2);
    }
  });

  // Convert to PEIndustryData array
  const peIndustryData = Array.from(industryMap.entries())
    .map(([industry, data]) => ({
      industry: industry,
      pe: calculateMedian(data.pe),
      pe1: calculateMedian(data.pe1),
      pe2: calculateMedian(data.pe2),
      companyCount: data.count,
    }))
    .filter(item => item.companyCount > 0);
  
  return peIndustryData;
}

function transformSMAData(results: { data: DataRow[]; meta: { fields: string[] | null } }): unknown[] {
  const smaData = results.data
    .map((row: DataRow) => {
      const companyName = getValue(['Company Name', 'Company', 'company'], row);
      const ticker = getValue(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
      const sma100Str = getValue(['SMA(100)', 'SMA(100)', 'sma(100)', 'sma100', 'SMA100'], row);
      const sma200Str = getValue(['SMA(200)', 'SMA(200)', 'sma(200)', 'sma200', 'SMA200'], row);
      const smaCrossStr = getValue(['SMA Cross', 'SMA Cross', 'sma cross', 'smaCross', 'SMACross', 'SMA CROSS'], row);
      
      // Only process if company name is valid (not #N/A)
      if (!isValidValue(companyName)) {
        return null;
      }
      
      // Filter out rows where Ticker is N/A
      if (!isValidValue(ticker)) {
        return null;
      }
      
      // Parse SMA(100) value as number (handle #N/A)
      const sma100 = parseNumericValueNullable(sma100Str);
      
      // Parse SMA(200) value as number (handle #N/A)
      const sma200 = parseNumericValueNullable(sma200Str);
      
      // Extract SMA Cross value as text (handle #N/A and empty values)
      let smaCross: string | null = null;
      if (smaCrossStr && smaCrossStr.trim()) {
        const trimmed = smaCrossStr.trim();
        // Convert #N/A to null, otherwise use the value
        if (trimmed.toUpperCase() !== '#N/A' && trimmed.toUpperCase() !== 'N/A' && trimmed !== '') {
          smaCross = trimmed;
        }
      }
      
      return {
        companyName: companyName,
        ticker: ticker,
        sma100: sma100,
        sma200: sma200,
        smaCross: smaCross,
      };
    })
    .filter((data) => data !== null);
  
  return smaData;
}

function transformScoreBoardData(
  results: { data: DataRow[]; meta: { fields: string[] | null } },
  industryPe1Map: Record<string, number>,
  industryPe2Map: Record<string, number>,
  smaDataMap: Record<string, { sma100: number | null; sma200: number | null; smaCross: string | null }>
): unknown[] {
  const scoreBoardData = results.data
    .map((row: DataRow) => {
      const companyName = getValueAllowZero(['Company Name', 'Company', 'company'], row);
      const ticker = getValueAllowZero(['Ticker', 'ticker', 'Ticket', 'ticket', 'Symbol', 'symbol'], row);
      const irrStr = getValueAllowZero(['IRR', 'irr', 'Irr'], row);
      const mungerQualityScoreStr = getValueAllowZero(['Munger Quality Score', 'Munger Quality Score', 'munger quality score', 'MUNGER QUALITY SCORE'], row);
      const valueCreationStr = getValueAllowZero(['VALUE CREATION', 'Value Creation', 'value creation', 'VALUE_CREATION'], row);
      const ro40CyStr = getValueAllowZero(['Ro40 CY', 'Ro40 CY', 'ro40 cy', 'RO40 CY'], row);
      const ro40F1Str = getValueAllowZero(['Ro40 F1', 'Ro40 F1', 'ro40 f1', 'RO40 F1'], row);
      const ro40F2Str = getValueAllowZero(['Ro40 F2', 'Ro40 F2', 'ro40 f2', 'RO40 F2'], row);
      const leverageF2Str = getValueAllowZero(['Leverage F2', 'Leverage F2', 'leverage f2', 'LEVERAGE F2'], row);
      const currentRatioStr = getValueAllowZero(['Current Ratio', 'Current Ratio', 'current ratio', 'CURRENT RATIO'], row);
      const cashSdebtStr = getValueAllowZero(['Cash/SDebt', 'Cash/SDebt', 'cash/sdebt', 'CASH/SDEBT'], row);
      
      // Detect division-by-zero for Cash/SDebt
      const isCashSdebtDivZero = cashSdebtStr && 
        (cashSdebtStr.trim().toUpperCase() === '#DIV/0!' || 
         cashSdebtStr.trim().toUpperCase() === 'INF' ||
         cashSdebtStr.trim().toUpperCase() === '∞');
      
      // Get (TB/S)/Price directly from Dashboard sheet
      const tbSPriceStr = getValueAllowZero(['(TB/S)/Price', '(TB/S)/Price', '(tb/s)/price', '(TB/S)/PRICE'], row);
      
      const pe1Str = getValueAllowZero(['P/E1', 'P/E 1', 'pe1', 'PE1'], row);
      const pe2Str = getValueAllowZero(['P/E2', 'P/E 2', 'pe2', 'PE2'], row);
      const industryStr = getValueAllowZero(['INDUSTRY', 'Industry', 'industry'], row);
      
      // Filter out rows where Company Name or Ticker is N/A
      if (!isValidValue(companyName) || !isValidValue(ticker)) {
        return null;
      }

      const irr = parseNumericValueNullable(irrStr);
      const mungerQualityScore = parseNumericValueNullable(mungerQualityScoreStr);
      const valueCreation = parsePercentageValueNullable(valueCreationStr);
      const ro40Cy = parsePercentageValueNullable(ro40CyStr);
      const ro40F1 = parsePercentageValueNullable(ro40F1Str);
      const ro40F2 = parsePercentageValueNullable(ro40F2Str);
      const leverageF2 = parseNumericValueNullable(leverageF2Str);
      const currentRatio = parseNumericValueNullable(currentRatioStr);
      const cashSdebt = parseNumericValueNullable(cashSdebtStr);
      // Om #DIV/0! detekteras, sätt cashSdebt till 0 istället för null
      const finalCashSdebt = isCashSdebtDivZero ? 0 : cashSdebt;
      
      // Parse (TB/S)/Price directly from column
      const tbSPrice = parseNumericValueNullable(tbSPriceStr);
      
      // Calculate P/E1 INDUSTRY (procentuell skillnad)
      const pe1 = parseNumericValueNullable(pe1Str);
      let pe1Industry: number | null = null;
      
      if (isValidValue(industryStr) && pe1 !== null && pe1 > 0) {
        const industryKey = industryStr.trim().toLowerCase();
        const pe1IndustryMedian = industryPe1Map[industryKey];
        
        if (pe1IndustryMedian !== undefined && pe1IndustryMedian > 0) {
          // Calculate percentage difference: (pe1 - pe1IndustryMedian) / pe1IndustryMedian * 100
          pe1Industry = ((pe1 - pe1IndustryMedian) / pe1IndustryMedian) * 100;
        }
      }
      
      // Calculate P/E2 INDUSTRY (procentuell skillnad)
      const pe2 = parseNumericValueNullable(pe2Str);
      let pe2Industry: number | null = null;
      
      if (isValidValue(industryStr) && pe2 !== null && pe2 > 0) {
        const industryKey = industryStr.trim().toLowerCase();
        const pe2IndustryMedian = industryPe2Map[industryKey];
        
        if (pe2IndustryMedian !== undefined && pe2IndustryMedian > 0) {
          // Calculate percentage difference: (pe2 - pe2IndustryMedian) / pe2IndustryMedian * 100
          pe2Industry = ((pe2 - pe2IndustryMedian) / pe2IndustryMedian) * 100;
        }
      }

      // Match SMA(100), SMA(200), and SMA Cross from SMA sheet by ticker
      const tickerKey = ticker.toLowerCase().trim();
      const smaMatch = smaDataMap[tickerKey];

      return {
        companyName: companyName,
        ticker: ticker,
        industry: industryStr || '',
        irr: irr,
        mungerQualityScore: mungerQualityScore,
        valueCreation: valueCreation,
        tbSPrice: tbSPrice,
        ro40Cy: ro40Cy,
        ro40F1: ro40F1,
        ro40F2: ro40F2,
        leverageF2: leverageF2,
        pe1Industry: pe1Industry,
        pe2Industry: pe2Industry,
        currentRatio: currentRatio,
        cashSdebt: finalCashSdebt,
        isCashSdebtDivZero: isCashSdebtDivZero || false,
        sma100: smaMatch ? smaMatch.sma100 : null,
        sma200: smaMatch ? smaMatch.sma200 : null,
        smaCross: smaMatch ? smaMatch.smaCross : null,
      };
    })
    .filter((data) => data !== null);
  
  return scoreBoardData;
}

// For Threshold Industry, we need the industry threshold maps
// We'll pass them as part of the message data
function transformThresholdIndustryData(
  results: { data: DataRow[]; meta: { fields: string[] | null } },
  industryIRRMap: Record<string, number>,
  industryLeverageF2Map: Record<string, { greenMax: number; redMin: number }>,
  industryRO40Map: Record<string, { min: number; max: number }>,
  industryCashSdebtMap: Record<string, { min: number; max: number }>,
  industryCurrentRatioMap: Record<string, { min: number; max: number }>
): unknown[] {
  // Extract unique industries
  const industrySet = new Set<string>();

  results.data.forEach((row: DataRow) => {
    const industry = getValue(['INDUSTRY', 'Industry', 'industry'], row);
    
    // Filter out invalid values
    if (isValidValue(industry)) {
      industrySet.add(industry);
    }
  });

  // Convert Set to sorted array of ThresholdIndustryData
  const thresholdIndustryData = Array.from(industrySet)
    .sort()
    .map((industry) => {
      // Find IRR value
      let irrValue = 0;
      const industryLower = industry.toLowerCase();
      if (industryIRRMap[industry]) {
        irrValue = industryIRRMap[industry];
      } else {
        // Try case-insensitive match
        for (const [key, value] of Object.entries(industryIRRMap)) {
          if (key.toLowerCase() === industryLower) {
            irrValue = value;
            break;
          }
        }
      }

      // Find Leverage F2 values
      let leverageF2Values = { min: 0, max: 0 };
      if (industryLeverageF2Map[industry]) {
        const { greenMax, redMin } = industryLeverageF2Map[industry];
        leverageF2Values = { min: greenMax, max: redMin };
      } else {
        // Try case-insensitive match
        for (const [key, value] of Object.entries(industryLeverageF2Map)) {
          if (key.toLowerCase() === industryLower) {
            leverageF2Values = { min: value.greenMax, max: value.redMin };
            break;
          }
        }
      }

      // Find RO40 values
      let ro40Values = { min: 0, max: 0 };
      if (industryRO40Map[industry]) {
        ro40Values = industryRO40Map[industry];
      } else {
        // Try case-insensitive match
        for (const [key, value] of Object.entries(industryRO40Map)) {
          if (key.toLowerCase() === industryLower) {
            ro40Values = value;
            break;
          }
        }
      }

      // Find Cash/SDebt values
      let cashSdebtValues = { min: 0, max: 0 };
      if (industryCashSdebtMap[industry]) {
        cashSdebtValues = industryCashSdebtMap[industry];
      } else {
        // Try case-insensitive match
        for (const [key, value] of Object.entries(industryCashSdebtMap)) {
          if (key.toLowerCase() === industryLower) {
            cashSdebtValues = value;
            break;
          }
        }
      }

      // Find Current Ratio values
      let currentRatioValues = { min: 0, max: 0 };
      if (industryCurrentRatioMap[industry]) {
        currentRatioValues = industryCurrentRatioMap[industry];
      } else {
        // Try case-insensitive match
        for (const [key, value] of Object.entries(industryCurrentRatioMap)) {
          if (key.toLowerCase() === industryLower) {
            currentRatioValues = value;
            break;
          }
        }
      }

      return {
        industry: industry,
        irr: irrValue,
        leverageF2Min: leverageF2Values.min,
        leverageF2Max: leverageF2Values.max,
        ro40Min: ro40Values.min,
        ro40Max: ro40Values.max,
        cashSdebtMin: cashSdebtValues.min,
        cashSdebtMax: cashSdebtValues.max,
        currentRatioMin: currentRatioValues.min,
        currentRatioMax: currentRatioValues.max,
      };
    });
  
  return thresholdIndustryData;
}

// ============================================================================
// Transformer Registry
// ============================================================================

type TransformerFunction = (results: { data: DataRow[]; meta: { fields: string[] | null } }, ...args: unknown[]) => unknown[];

const transformers: Record<string, TransformerFunction> = {
  'benjamin-graham': transformBenjaminGrahamData,
  'pe-industry': transformPEIndustryData,
  'sma': transformSMAData,
  'score-board': transformScoreBoardData,
  'threshold-industry': transformThresholdIndustryData,
};

// ============================================================================
// Worker Error Handlers
// ============================================================================

self.onerror = function(errorEvent: ErrorEvent) {
  console.error('[Worker] Unhandled error:', {
    message: errorEvent.message,
    filename: errorEvent.filename,
    lineno: errorEvent.lineno,
    colno: errorEvent.colno,
    error: errorEvent.error,
  });
  
  // Try to send error message if we have context
  // Note: We can't send a message without a jobId, so we just log it
  return false; // Don't prevent default error handling
};

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function(event: PromiseRejectionEvent) {
  console.error('[Worker] Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise,
  });
  
  // Prevent the default browser behavior
  event.preventDefault();
});

// ============================================================================
// Worker Message Handler
// ============================================================================

self.onmessage = function(e: MessageEvent<TransformMessage>) {
  const message = e.data;

  // Validate message structure
  if (!message || typeof message !== 'object') {
    console.error('[Worker] Invalid message received:', message);
    return;
  }

  if (message.type !== 'transform') {
    const jobId = message.jobId || 'unknown';
    self.postMessage({
      type: 'error',
      jobId,
      error: 'Invalid message type',
    } as ErrorMessage);
    return;
  }

  // Ensure jobId exists
  if (!message.jobId) {
    console.error('[Worker] Message missing jobId:', message);
    return;
  }

  try {
    const transformer = transformers[message.transformerId];
    if (!transformer) {
      self.postMessage({
        type: 'error',
        jobId: message.jobId,
        error: `Unknown transformer: ${message.transformerId}`,
      } as ErrorMessage);
      return;
    }

    // Send progress update at start
    self.postMessage({
      type: 'progress',
      jobId: message.jobId,
      stage: 'transform',
      percentage: 0,
      message: `Transforming ${message.transformerId} data...`,
      totalRows: message.data.length,
    } as ProgressMessage);

    // Transform data
    let transformedData: unknown[];
    const totalRows = message.data.length;

    if (message.transformerId === 'score-board') {
      // ScoreBoard needs external maps
      if (!message.industryPe1Map || !message.industryPe2Map || !message.smaDataMap) {
        throw new Error('ScoreBoard transformer requires industryPe1Map, industryPe2Map, and smaDataMap');
      }
      transformedData = transformer(
        { data: message.data, meta: message.meta },
        message.industryPe1Map,
        message.industryPe2Map,
        message.smaDataMap
      ) as unknown[];
    } else if (message.transformerId === 'threshold-industry') {
      // Threshold Industry needs industry maps - pass them as additionalData
      if (!message.industryIRRMap || !message.industryLeverageF2Map || !message.industryRO40Map || 
          !message.industryCashSdebtMap || !message.industryCurrentRatioMap) {
        throw new Error('Threshold Industry transformer requires all industry maps');
      }
      transformedData = transformer(
        { data: message.data, meta: message.meta },
        message.industryIRRMap as Record<string, number>,
        message.industryLeverageF2Map as Record<string, { greenMax: number; redMin: number }>,
        message.industryRO40Map as Record<string, { min: number; max: number }>,
        message.industryCashSdebtMap as Record<string, { min: number; max: number }>,
        message.industryCurrentRatioMap as Record<string, { min: number; max: number }>
      ) as unknown[];
    } else {
      transformedData = transformer({ data: message.data, meta: message.meta }) as unknown[];
    }

    // Send progress update during processing (simulate)
    if (totalRows > 100) {
      // For large datasets, send progress updates
      const chunkSize = Math.max(1, Math.floor(totalRows / 10));
      for (let i = 0; i < totalRows; i += chunkSize) {
        const progress = Math.min(90, Math.floor((i / totalRows) * 90));
        self.postMessage({
          type: 'progress',
          jobId: message.jobId,
          stage: 'transform',
          percentage: progress,
          message: `Processing rows ${i + 1}-${Math.min(i + chunkSize, totalRows)} of ${totalRows}...`,
          rowsProcessed: Math.min(i + chunkSize, totalRows),
          totalRows: totalRows,
        } as ProgressMessage);
      }
    }

    // Send completion message
    self.postMessage({
      type: 'complete',
      jobId: message.jobId,
      data: transformedData,
    } as CompleteMessage);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const jobId = message?.jobId || 'unknown';
    
    console.error('[Worker] Error in message handler:', {
      error,
      errorMessage,
      jobId,
      transformerId: message?.transformerId,
    });
    
    // Only send error message if we have a valid jobId
    if (message?.jobId) {
      self.postMessage({
        type: 'error',
        jobId: message.jobId,
        error: errorMessage,
      } as ErrorMessage);
    }
  }
};
