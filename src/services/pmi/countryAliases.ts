import type { PmiCountryCode } from './types';

export interface PmiCountryDescriptor {
  code: PmiCountryCode;
  name: string;
}

export const PMI_COUNTRIES: PmiCountryDescriptor[] = [
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'EE', name: 'Estonia' },
  { code: 'DE', name: 'Germany' },
  { code: 'DK', name: 'Denmark' },
  { code: 'ES', name: 'Spain' },
  { code: 'EZ', name: 'Euro Area' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'KR', name: 'South Korea' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'SK', name: 'Slovak Republic' },
  // Japan remains a future candidate: current verified manufacturing series is quarterly.
  { code: 'SE', name: 'Sweden' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'TR', name: 'Turkiye' },
  // United Kingdom remains a future candidate: current active manufacturing series is quarterly.
  { code: 'US', name: 'United States' },
];

const COUNTRY_ALIAS_TO_CODE: Record<string, PmiCountryCode> = {
  AUSTRIA: 'AT',
  AUT: 'AT',
  AT: 'AT',
  BELGIUM: 'BE',
  BEL: 'BE',
  BE: 'BE',
  BRAZIL: 'BR',
  BRA: 'BR',
  BR: 'BR',
  SWITZERLAND: 'CH',
  CHE: 'CH',
  CH: 'CH',
  CHILE: 'CL',
  CHL: 'CL',
  CL: 'CL',
  CHINA: 'CN',
  CHN: 'CN',
  CN: 'CN',
  ESTONIA: 'EE',
  EST: 'EE',
  EE: 'EE',
  GERMANY: 'DE',
  DE: 'DE',
  DENMARK: 'DK',
  DNK: 'DK',
  DK: 'DK',
  SPAIN: 'ES',
  ESP: 'ES',
  ES: 'ES',
  EURO_AREA: 'EZ',
  EUROZONE: 'EZ',
  EZ: 'EZ',
  FINLAND: 'FI',
  FIN: 'FI',
  FI: 'FI',
  FRANCE: 'FR',
  FRA: 'FR',
  FR: 'FR',
  GREECE: 'GR',
  GRC: 'GR',
  GR: 'GR',
  HUNGARY: 'HU',
  HUN: 'HU',
  HU: 'HU',
  IRELAND: 'IE',
  IRL: 'IE',
  IE: 'IE',
  ITALY: 'IT',
  ITA: 'IT',
  IT: 'IT',
  JAPAN: 'JP',
  JPN: 'JP',
  JP: 'JP',
  SOUTH_KOREA: 'KR',
  KOREA: 'KR',
  KOR: 'KR',
  KR: 'KR',
  LITHUANIA: 'LT',
  LTU: 'LT',
  LT: 'LT',
  MEXICO: 'MX',
  MEX: 'MX',
  MX: 'MX',
  NETHERLANDS: 'NL',
  NLD: 'NL',
  NL: 'NL',
  POLAND: 'PL',
  POL: 'PL',
  PL: 'PL',
  PORTUGAL: 'PT',
  PRT: 'PT',
  PT: 'PT',
  SLOVAK_REPUBLIC: 'SK',
  SLOVAKIA: 'SK',
  SVK: 'SK',
  SK: 'SK',
  SLOVENIA: 'SI',
  SVN: 'SI',
  SI: 'SI',
  SWEDEN: 'SE',
  SWE: 'SE',
  TURKIYE: 'TR',
  TURKEY: 'TR',
  TUR: 'TR',
  TR: 'TR',
  UNITED_KINGDOM: 'UK',
  UK: 'UK',
  UNITED_STATES: 'US',
  US: 'US',
  USA: 'US',
};

const COUNTRY_CODE_TO_NAME: Record<PmiCountryCode, string> = {
  AT: 'Austria',
  BE: 'Belgium',
  BR: 'Brazil',
  CH: 'Switzerland',
  CL: 'Chile',
  CN: 'China',
  EE: 'Estonia',
  DE: 'Germany',
  DK: 'Denmark',
  ES: 'Spain',
  EZ: 'Euro Area',
  FI: 'Finland',
  FR: 'France',
  GR: 'Greece',
  HU: 'Hungary',
  IE: 'Ireland',
  IT: 'Italy',
  JP: 'Japan',
  KR: 'South Korea',
  LT: 'Lithuania',
  MX: 'Mexico',
  NL: 'Netherlands',
  PL: 'Poland',
  PT: 'Portugal',
  SE: 'Sweden',
  SI: 'Slovenia',
  SK: 'Slovak Republic',
  TR: 'Turkiye',
  UK: 'United Kingdom',
  US: 'United States',
};

const COUNTRY_CODE_ALIASES: Record<PmiCountryCode, string[]> = {
  AT: ['Austria', 'AUT', 'AT'],
  BE: ['Belgium', 'BEL', 'BE'],
  BR: ['Brazil', 'BRA', 'BR'],
  CH: ['Switzerland', 'CHE', 'CH'],
  CL: ['Chile', 'CHL', 'CL'],
  CN: ['China', 'CHN', 'CN'],
  EE: ['Estonia', 'EST', 'EE'],
  DE: ['Germany', 'DE'],
  DK: ['Denmark', 'DNK', 'DK'],
  ES: ['Spain', 'ESP', 'ES'],
  EZ: ['Euro Area', 'Eurozone', 'EZ'],
  FI: ['Finland', 'FIN', 'FI'],
  FR: ['France', 'FRA', 'FR'],
  GR: ['Greece', 'GRC', 'GR'],
  HU: ['Hungary', 'HUN', 'HU'],
  IE: ['Ireland', 'IRL', 'IE'],
  IT: ['Italy', 'ITA', 'IT'],
  JP: ['Japan', 'JPN', 'JP'],
  KR: ['South Korea', 'Korea', 'KOR', 'KR'],
  LT: ['Lithuania', 'LTU', 'LT'],
  MX: ['Mexico', 'MEX', 'MX'],
  NL: ['Netherlands', 'NLD', 'NL'],
  PL: ['Poland', 'POL', 'PL'],
  PT: ['Portugal', 'PRT', 'PT'],
  SE: ['Sweden', 'SWE'],
  SI: ['Slovenia', 'SVN', 'SI'],
  SK: ['Slovak Republic', 'Slovakia', 'SVK', 'SK'],
  TR: ['Turkiye', 'Turkey', 'TUR', 'TR'],
  UK: ['United Kingdom', 'UK'],
  US: ['United States', 'US', 'USA'],
};

function normalizeAliasToken(value: string): string {
  return value.trim().replace(/\s+/g, '_').toUpperCase();
}

export function resolvePmiCountryCode(input: string): PmiCountryCode | null {
  if (!input) {
    return null;
  }
  return COUNTRY_ALIAS_TO_CODE[normalizeAliasToken(input)] ?? null;
}

export function getPmiCountryName(code: PmiCountryCode): string {
  return COUNTRY_CODE_TO_NAME[code];
}

export function getPmiCountryAliases(code: PmiCountryCode): string[] {
  return COUNTRY_CODE_ALIASES[code];
}

export function getPmiCountrySearchTokens(code: PmiCountryCode): string[] {
  const canonical = getPmiCountryName(code);
  return [canonical, ...getPmiCountryAliases(code)].map(normalizeAliasToken);
}

