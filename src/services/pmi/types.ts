export type PmiType = 'composite' | 'manufacturing' | 'services';

export type PmiCountryCode =
  | 'AT'
  | 'BE'
  | 'BR'
  | 'CH'
  | 'CL'
  | 'CN'
  | 'EE'
  | 'DE'
  | 'DK'
  | 'ES'
  | 'EZ'
  | 'FI'
  | 'FR'
  | 'GR'
  | 'HU'
  | 'IE'
  | 'IT'
  | 'JP'
  | 'KR'
  | 'LT'
  | 'MX'
  | 'NL'
  | 'PL'
  | 'PT'
  | 'SE'
  | 'SI'
  | 'SK'
  | 'TR'
  | 'UK'
  | 'US';

export interface PmiMetadata {
  source: string;
  fetchedAt: number;
  latestAvailableRelease: string | null;
}

export interface PmiMonthDataPoint {
  month: string;
  value: number | null;
  previousValue: number | null;
  changeVsPrevious: number | null;
}

export interface PmiHeatmapRow {
  countryCode: PmiCountryCode;
  countryName: string;
  months: PmiMonthDataPoint[];
}

export interface PmiHeatmapData {
  type: PmiType;
  rows: PmiHeatmapRow[];
  months: string[];
  metadata: PmiMetadata;
}

export interface PmiHistoryPoint {
  date: string;
  value: number | null;
  changeVsPrevious: number | null;
}

export interface PmiCountryDetailData {
  type: PmiType;
  countryCode: PmiCountryCode;
  countryName: string;
  latestValue: number | null;
  previousValue: number | null;
  changeVsPrevious: number | null;
  history: PmiHistoryPoint[];
  metadata: PmiMetadata;
}

export interface FredObservationRaw {
  date: string;
  value: string;
}

export interface PmiFredSeriesResult {
  seriesId: string;
  observations: FredObservationRaw[];
}

export interface PmiFredCallableBaseResponse {
  source: string;
  fetchedAt: number;
  series: PmiFredSeriesResult[];
}

export interface PmiFredHeatmapResponse extends PmiFredCallableBaseResponse {
  mode: 'heatmap';
}

export interface PmiFredCountryHistoryResponse extends PmiFredCallableBaseResponse {
  mode: 'countryHistory';
}

export interface PmiSeriesMap {
  composite: Record<PmiCountryCode, string | null>;
  manufacturing: Record<PmiCountryCode, string | null>;
  services: Record<PmiCountryCode, string | null>;
}

