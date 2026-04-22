import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { getPmiCountryName, resolvePmiCountryCode } from './countryAliases';
import {
  getPmiHeatmapSeriesDescriptorsWithOptionalIds,
  getPmiSeriesId,
} from './pmiSeriesMap';
import type {
  FredObservationRaw,
  PmiCountryDetailData,
  PmiCountryCode,
  PmiFredCountryHistoryResponse,
  PmiFredHeatmapResponse,
  PmiHeatmapData,
  PmiHistoryPoint,
  PmiMonthDataPoint,
  PmiType,
} from './types';

interface HeatmapCallableRequest {
  mode: 'heatmap';
  seriesIds: string[];
}

interface CountryHistoryCallableRequest {
  mode: 'countryHistory';
  seriesId: string;
  limit?: number;
}

type PmiCallableRequest = HeatmapCallableRequest | CountryHistoryCallableRequest;
type PmiCallableResponse = PmiFredHeatmapResponse | PmiFredCountryHistoryResponse;

const HISTORY_LIMIT = 120;

function parseFredNumber(raw: string): number | null {
  if (!raw || raw === '.') {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortByDateAsc<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

function buildLatestMonths(observations: FredObservationRaw[], monthCount: number): PmiMonthDataPoint[] {
  const parsed = sortByDateAsc(observations)
    .map((item) => ({ date: item.date, value: parseFredNumber(item.value) }))
    .filter((item) => item.value !== null);

  if (parsed.length === 0) {
    return [];
  }

  const requiredLength = monthCount + 1;
  const tail = parsed.slice(-requiredLength);

  return tail.slice(-monthCount).map((current, index, currentList) => {
    const previousValue =
      index === 0 ? (tail.length > monthCount ? tail[0].value : null) : currentList[index - 1].value;
    const value = current.value;
    const changeVsPrevious = value !== null && previousValue !== null ? value - previousValue : null;

    return {
      month: current.date.slice(0, 7),
      value,
      previousValue,
      changeVsPrevious,
    };
  });
}

function buildHistory(observations: FredObservationRaw[]): PmiHistoryPoint[] {
  const parsed = sortByDateAsc(observations)
    .map((item) => ({ date: item.date, value: parseFredNumber(item.value) }))
    .filter((item) => item.value !== null);

  return parsed.map((item, index, list) => {
    const previousValue = index > 0 ? list[index - 1].value : null;
    return {
      date: item.date,
      value: item.value,
      changeVsPrevious:
        item.value !== null && previousValue !== null ? item.value - previousValue : null,
    };
  });
}

const pmiFredProxy = httpsCallable<PmiCallableRequest, PmiCallableResponse>(functions, 'pmiFredProxy');

export async function fetchPmiHeatmapData(type: PmiType): Promise<PmiHeatmapData> {
  const descriptors = getPmiHeatmapSeriesDescriptorsWithOptionalIds(type);
  const availableDescriptors = descriptors.filter(
    (
      item
    ): item is {
      countryCode: PmiCountryCode;
      countryName: string;
      seriesId: string;
    } => item.seriesId !== null
  );

  if (availableDescriptors.length === 0) {
    throw new Error(
      `PMI series ID is missing for type "${type}" and country "ALL". ` +
        'Populate src/services/pmi/pmiSeriesMap.ts with verified FRED series IDs before fetching.'
    );
  }

  const result = await pmiFredProxy({
    mode: 'heatmap',
    seriesIds: availableDescriptors.map((item) => item.seriesId),
  });
  const payload = result.data;

  if (payload.mode !== 'heatmap') {
    throw new Error('Unexpected PMI response mode for heatmap');
  }

  const seriesById = new Map(payload.series.map((entry) => [entry.seriesId, entry.observations]));

  const rows = descriptors.map((descriptor) => ({
    countryCode: descriptor.countryCode,
    countryName: descriptor.countryName,
    months: descriptor.seriesId
      ? buildLatestMonths(seriesById.get(descriptor.seriesId) ?? [], 3)
      : [],
  }));

  const monthSet = new Set<string>();
  rows.forEach((row) => {
    row.months.forEach((point) => {
      monthSet.add(point.month);
    });
  });
  const months = Array.from(monthSet).sort();

  return {
    type,
    rows,
    months,
    metadata: {
      source: payload.source,
      fetchedAt: payload.fetchedAt,
      latestAvailableRelease: (() => {
        const sortedMonths = rows
          .flatMap((row) => row.months)
          .sort((a, b) => a.month.localeCompare(b.month));
        return sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1].month : null;
      })(),
    },
  };
}

export async function fetchPmiCountryDetailData(
  type: PmiType,
  countryInput: string
): Promise<PmiCountryDetailData> {
  const countryCode = resolvePmiCountryCode(countryInput);
  if (!countryCode) {
    throw new Error(`Unsupported PMI country "${countryInput}"`);
  }

  const seriesId = getPmiSeriesId(type, countryCode);
  const result = await pmiFredProxy({
    mode: 'countryHistory',
    seriesId,
    limit: HISTORY_LIMIT,
  });
  const payload = result.data;

  if (payload.mode !== 'countryHistory') {
    throw new Error('Unexpected PMI response mode for country history');
  }

  const observations = payload.series[0]?.observations ?? [];
  const history = buildHistory(observations);
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const previous = history.length > 1 ? history[history.length - 2] : null;

  return {
    type,
    countryCode: countryCode as PmiCountryCode,
    countryName: getPmiCountryName(countryCode),
    latestValue: latest?.value ?? null,
    previousValue: previous?.value ?? null,
    changeVsPrevious: latest?.changeVsPrevious ?? null,
    history,
    metadata: {
      source: payload.source,
      fetchedAt: payload.fetchedAt,
      latestAvailableRelease: latest?.date ?? null,
    },
  };
}

