import { 
  ScoreBoardData, 
  ThresholdIndustryData, 
  BenjaminGrahamData,
  SMAData,
  EntryExitData,
  PEIndustryData
} from '../types/stock';
import { EntryExitValues } from '../contexts/EntryExitContext';
import { ScoreData } from '../components/views/ScoreView';

/**
 * Create mock ScoreBoardData for testing
 */
export function createMockScoreBoardData(overrides: Partial<ScoreBoardData> = {}): ScoreBoardData {
  return {
    companyName: 'Test Company',
    ticker: 'TEST',
    industry: 'Test Industry',
    irr: null,
    mungerQualityScore: null,
    valueCreation: null,
    tbSPrice: null,
    ro40Cy: null,
    ro40F1: null,
    ro40F2: null,
    leverageF2: null,
    pe1Industry: null,
    pe2Industry: null,
    currentRatio: null,
    cashSdebt: null,
    isCashSdebtDivZero: false,
    sma100: null,
    sma200: null,
    smaCross: null,
    price: null,
    ...overrides,
  };
}

/**
 * Create mock ThresholdIndustryData for testing
 */
export function createMockThresholdData(overrides: Partial<ThresholdIndustryData> = {}): ThresholdIndustryData {
  return {
    industry: 'Test Industry',
    irr: 25,
    leverageF2Min: 2.0,
    leverageF2Max: 3.0,
    ro40Min: 0.15,
    ro40Max: 0.25,
    cashSdebtMin: 0.7,
    cashSdebtMax: 1.2,
    currentRatioMin: 1.1,
    currentRatioMax: 2.0,
    ...overrides,
  };
}

/**
 * Create mock BenjaminGrahamData for testing
 */
export function createMockBenjaminGrahamData(overrides: Partial<BenjaminGrahamData> = {}): BenjaminGrahamData {
  return {
    companyName: 'Test Company',
    ticker: 'TEST',
    price: 100,
    benjaminGraham: 90,
    ...overrides,
  };
}

/**
 * Create mock EntryExitValues for testing
 */
export function createMockEntryExitValues(overrides: Partial<EntryExitValues> = {}): EntryExitValues {
  return {
    entry1: 0,
    entry2: 0,
    exit1: 0,
    exit2: 0,
    currency: 'USD',
    dateOfUpdate: null,
    ...overrides,
  };
}

/**
 * Create a Map of EntryExitValues for testing
 */
export function createMockEntryExitValuesMap(
  entries: Array<{ ticker: string; companyName: string; values: Partial<EntryExitValues> }> = []
): Map<string, EntryExitValues> {
  const map = new Map<string, EntryExitValues>();
  entries.forEach(({ ticker, companyName, values }) => {
    const key = `${ticker}-${companyName}`;
    map.set(key, createMockEntryExitValues(values));
  });
  return map;
}

/**
 * Create mock SMAData for testing
 */
export function createMockSMAData(overrides: Partial<SMAData> = {}): SMAData {
  return {
    companyName: 'Test Company',
    ticker: 'TEST',
    sma100: 100,
    sma200: 95,
    smaCross: null,
    ...overrides,
  };
}

/**
 * Create mock EntryExitData for testing
 */
export function createMockEntryExitData(overrides: Partial<EntryExitData> = {}): EntryExitData {
  return {
    companyName: 'Test Company',
    ticker: 'TEST',
    currency: 'USD',
    entry1: 100,
    entry2: 90,
    exit1: 150,
    exit2: 140,
    dateOfUpdate: '2024-01-01',
    ...overrides,
  };
}

/**
 * Create mock PEIndustryData for testing
 */
export function createMockPEIndustryData(overrides: Partial<PEIndustryData> = {}): PEIndustryData {
  return {
    industry: 'Test Industry',
    pe: 15,
    pe1: 20,
    pe2: 18,
    companyCount: 10,
    ...overrides,
  };
}

/**
 * Create mock ScoreData for testing
 */
export function createMockScoreData(overrides: Partial<ScoreData> = {}): ScoreData {
  return {
    companyName: 'Test Company',
    ticker: 'TEST',
    score: 50,
    scoreBoardData: createMockScoreBoardData(),
    ...overrides,
  };
}

/**
 * Generate a large array of ScoreBoardData
 */
export function generateLargeScoreBoardDataSet(count: number): ScoreBoardData[] {
  const industries = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer'];
  const data: ScoreBoardData[] = [];
  
  for (let i = 0; i < count; i++) {
    const industry = industries[i % industries.length];
    data.push(createMockScoreBoardData({
      companyName: `Company ${i + 1}`,
      ticker: `TICK${String(i + 1).padStart(3, '0')}`,
      industry,
      irr: Math.random() * 50,
      mungerQualityScore: Math.random() * 100,
      valueCreation: (Math.random() - 0.5) * 20,
      tbSPrice: Math.random() * 2,
      ro40F1: Math.random() * 30,
      ro40F2: Math.random() * 30,
      currentRatio: Math.random() * 3,
      cashSdebt: Math.random() * 2,
      leverageF2: Math.random() * 5,
      pe1Industry: (Math.random() - 0.5) * 20,
      pe2Industry: (Math.random() - 0.5) * 20,
      sma100: 100 + Math.random() * 50,
      sma200: 90 + Math.random() * 50,
      smaCross: Math.random() > 0.5 ? 'GOLDEN CROSS' : 'DEATH CROSS',
      price: 100 + Math.random() * 50,
    }));
  }
  
  return data;
}

/**
 * Generate edge case ScoreBoardData with null values and extreme values
 */
export function generateEdgeCaseScoreBoardData(): ScoreBoardData[] {
  return [
    // All null values
    createMockScoreBoardData({
      companyName: 'Null Company',
      ticker: 'NULL',
      industry: 'Test Industry',
      irr: null,
      mungerQualityScore: null,
      valueCreation: null,
      tbSPrice: null,
      ro40F1: null,
      ro40F2: null,
      currentRatio: null,
      cashSdebt: null,
      leverageF2: null,
      pe1Industry: null,
      pe2Industry: null,
      sma100: null,
      sma200: null,
      smaCross: null,
      price: null,
    }),
    // Extreme positive values
    createMockScoreBoardData({
      companyName: 'Extreme High',
      ticker: 'HIGH',
      industry: 'Test Industry',
      irr: 999,
      mungerQualityScore: 100,
      valueCreation: 999,
      tbSPrice: 999,
      ro40F1: 999,
      ro40F2: 999,
      currentRatio: 999,
      cashSdebt: 999,
      leverageF2: 999,
      pe1Industry: 999,
      pe2Industry: 999,
      sma100: 9999,
      sma200: 9999,
      price: 9999,
    }),
    // Extreme negative values
    createMockScoreBoardData({
      companyName: 'Extreme Low',
      ticker: 'LOW',
      industry: 'Test Industry',
      irr: -999,
      mungerQualityScore: 0,
      valueCreation: -999,
      tbSPrice: 0.01,
      ro40F1: -999,
      ro40F2: -999,
      currentRatio: 0.01,
      cashSdebt: 0.01,
      leverageF2: 0.01,
      pe1Industry: -999,
      pe2Industry: -999,
      sma100: 0.01,
      sma200: 0.01,
      price: 0.01,
    }),
    // Special characters in text fields
    createMockScoreBoardData({
      companyName: "Company & Co. <Special> 'Chars'",
      ticker: 'SP&L',
      industry: 'Test & Industry',
    }),
    // DivZero case
    createMockScoreBoardData({
      companyName: 'DivZero Company',
      ticker: 'DIV0',
      industry: 'Test Industry',
      cashSdebt: null,
      isCashSdebtDivZero: true,
    }),
    // Empty strings
    createMockScoreBoardData({
      companyName: '',
      ticker: '',
      industry: '',
    }),
  ];
}

/**
 * Generate large array of BenjaminGrahamData
 */
export function generateLargeBenjaminGrahamDataSet(count: number): BenjaminGrahamData[] {
  const data: BenjaminGrahamData[] = [];
  
  for (let i = 0; i < count; i++) {
    data.push(createMockBenjaminGrahamData({
      companyName: `Company ${i + 1}`,
      ticker: `TICK${String(i + 1).padStart(3, '0')}`,
      price: 50 + Math.random() * 200,
      benjaminGraham: 40 + Math.random() * 180,
      ivFcf: Math.random() > 0.5 ? 100 + Math.random() * 150 : null,
      irr1: Math.random() > 0.5 ? Math.random() * 50 : null,
    }));
  }
  
  return data;
}

/**
 * Generate large array of SMAData
 */
export function generateLargeSMADataSet(count: number): SMAData[] {
  const data: SMAData[] = [];
  const crossTypes = ['GOLDEN CROSS', 'DEATH CROSS', null];
  
  for (let i = 0; i < count; i++) {
    data.push(createMockSMAData({
      companyName: `Company ${i + 1}`,
      ticker: `TICK${String(i + 1).padStart(3, '0')}`,
      sma100: 80 + Math.random() * 100,
      sma200: 70 + Math.random() * 100,
      smaCross: crossTypes[i % crossTypes.length],
    }));
  }
  
  return data;
}

/**
 * Generate large array of EntryExitData
 */
export function generateLargeEntryExitDataSet(count: number): EntryExitData[] {
  const data: EntryExitData[] = [];
  const currencies = ['USD', 'EUR', 'SEK'];
  
  for (let i = 0; i < count; i++) {
    const basePrice = 100 + Math.random() * 100;
    data.push(createMockEntryExitData({
      companyName: `Company ${i + 1}`,
      ticker: `TICK${String(i + 1).padStart(3, '0')}`,
      currency: currencies[i % currencies.length],
      entry1: basePrice * 0.9,
      entry2: basePrice * 0.8,
      exit1: basePrice * 1.5,
      exit2: basePrice * 1.4,
      dateOfUpdate: `2024-${String((i % 12) + 1).padStart(2, '0')}-01`,
    }));
  }
  
  return data;
}

/**
 * Generate large array of ThresholdIndustryData
 */
export function generateLargeThresholdDataSet(count: number): ThresholdIndustryData[] {
  const industries = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer', 'Manufacturing', 'Retail', 'Telecom'];
  const data: ThresholdIndustryData[] = [];
  
  for (let i = 0; i < count; i++) {
    const industry = industries[i % industries.length];
    data.push(createMockThresholdData({
      industry: `${industry} ${Math.floor(i / industries.length) + 1}`,
      irr: 15 + Math.random() * 20,
      leverageF2Min: 1.5 + Math.random(),
      leverageF2Max: 2.5 + Math.random(),
      ro40Min: 0.1 + Math.random() * 0.1,
      ro40Max: 0.2 + Math.random() * 0.1,
      cashSdebtMin: 0.5 + Math.random() * 0.5,
      cashSdebtMax: 1.0 + Math.random() * 0.5,
      currentRatioMin: 1.0 + Math.random() * 0.5,
      currentRatioMax: 1.5 + Math.random() * 0.5,
    }));
  }
  
  return data;
}

/**
 * Generate large array of PEIndustryData
 */
export function generateLargePEIndustryDataSet(count: number): PEIndustryData[] {
  const industries = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer'];
  const data: PEIndustryData[] = [];
  
  for (let i = 0; i < count; i++) {
    const industry = industries[i % industries.length];
    data.push(createMockPEIndustryData({
      industry: `${industry} ${Math.floor(i / industries.length) + 1}`,
      pe: 10 + Math.random() * 30,
      pe1: 15 + Math.random() * 30,
      pe2: 12 + Math.random() * 30,
      companyCount: 5 + Math.floor(Math.random() * 20),
    }));
  }
  
  return data;
}

/**
 * Generate large array of ScoreData
 */
export function generateLargeScoreDataSet(count: number): ScoreData[] {
  const data: ScoreData[] = [];
  
  for (let i = 0; i < count; i++) {
    data.push(createMockScoreData({
      companyName: `Company ${i + 1}`,
      ticker: `TICK${String(i + 1).padStart(3, '0')}`,
      score: Math.random() * 100,
      scoreBoardData: createMockScoreBoardData({
        companyName: `Company ${i + 1}`,
        ticker: `TICK${String(i + 1).padStart(3, '0')}`,
      }),
    }));
  }
  
  return data;
}

/**
 * Create filter combinations for testing
 */
export interface FilterCombination {
  companyName?: string;
  ticker?: string;
  industry?: string;
  irr?: { min?: number; max?: number };
  mungerQualityScore?: { min?: number; max?: number };
  valueCreation?: { min?: number; max?: number };
  ro40F1?: { min?: number; max?: number };
  ro40F2?: { min?: number; max?: number };
  currentRatio?: { min?: number; max?: number };
  score?: { min?: number; max?: number };
  price?: { min?: number; max?: number };
  benjaminGraham?: { min?: number; max?: number };
}

/**
 * Common filter combinations for testing
 */
export const COMMON_FILTER_COMBINATIONS: FilterCombination[] = [
  // Single filters
  { companyName: 'Test' },
  { ticker: 'TEST' },
  { industry: 'Test Industry' },
  { irr: { min: 20, max: 30 } },
  { mungerQualityScore: { min: 50, max: 75 } },
  
  // Two filters
  { companyName: 'Test', industry: 'Test Industry' },
  { irr: { min: 20 }, mungerQualityScore: { min: 50 } },
  { ticker: 'TEST', valueCreation: { min: 0 } },
  
  // Three filters
  { companyName: 'Test', industry: 'Test Industry', irr: { min: 20 } },
  { ticker: 'TEST', ro40F1: { min: 10 }, ro40F2: { min: 10 } },
  
  // Range filters
  { irr: { min: 15, max: 25 } },
  { mungerQualityScore: { min: 40, max: 60 } },
  { valueCreation: { min: -10, max: 10 } },
  
  // Extreme ranges
  { irr: { min: 0, max: 1000 } },
  { mungerQualityScore: { min: 0, max: 100 } },
];

