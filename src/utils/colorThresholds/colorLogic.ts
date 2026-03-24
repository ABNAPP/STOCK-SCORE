/**
 * Centralized color classification logic.
 * Used by calculateScore, calculateScoreDetailed, and ScoreBoardTable (via cssMapping).
 */

import type { IndustryThresholdData } from '../../types/stock';
import {
  MUNGER_QUALITY_SCORE_RED_THRESHOLD,
  MUNGER_QUALITY_SCORE_GREEN_THRESHOLD,
} from '../../config/constants';
import type { ColorType } from './types';

export function getMungerQualityScoreColor(mungerQualityScore: number | null): ColorType {
  if (mungerQualityScore === null || !isFinite(mungerQualityScore)) return 'BLANK';
  if (mungerQualityScore < MUNGER_QUALITY_SCORE_RED_THRESHOLD) return 'RED';
  if (
    mungerQualityScore >= MUNGER_QUALITY_SCORE_RED_THRESHOLD &&
    mungerQualityScore <= MUNGER_QUALITY_SCORE_GREEN_THRESHOLD
  )
    return 'ORANGE';
  return 'GREEN';
}

export function getValueCreationColor(valueCreation: number | null): ColorType {
  if (valueCreation === null || !isFinite(valueCreation)) return 'BLANK';
  return valueCreation >= 0 ? 'GREEN' : 'RED';
}

export function getLeverageF2Color(
  leverageF2Value: number | null,
  industry: string,
  thresholdData: IndustryThresholdData[]
): ColorType {
  if (leverageF2Value === null || !isFinite(leverageF2Value)) return 'BLANK';
  if (!industry || industry.trim() === '') return 'BLANK';

  const threshold = thresholdData.find(
    (t) => t.industry.toLowerCase() === industry.toLowerCase()
  );
  if (!threshold) return 'BLANK';

  const { leverageF2Min, leverageF2Max } = threshold;
  if (leverageF2Value <= leverageF2Min) return 'GREEN';
  if (leverageF2Value <= leverageF2Max) return 'ORANGE';
  return 'RED';
}

export function getCashSdebtColor(
  cashSdebt: number | null,
  isDivZero: boolean,
  industry: string,
  thresholdData: IndustryThresholdData[]
): ColorType {
  if (isDivZero) return 'GREEN';
  if (cashSdebt === null || !isFinite(cashSdebt)) return 'BLANK';
  if (!industry || industry.trim() === '') return 'BLANK';

  const threshold = thresholdData.find(
    (t) => t.industry.toLowerCase() === industry.toLowerCase()
  );
  if (!threshold) return 'BLANK';

  const { cashSdebtMin, cashSdebtMax } = threshold;
  if (cashSdebt <= cashSdebtMin) return 'RED';
  if (cashSdebt >= cashSdebtMax) return 'GREEN';
  return 'ORANGE';
}

export function getCurrentRatioColor(
  currentRatio: number | null,
  industry: string,
  thresholdData: IndustryThresholdData[]
): ColorType {
  if (currentRatio === null || !isFinite(currentRatio)) return 'BLANK';
  if (!industry || industry.trim() === '') return 'BLANK';

  const threshold = thresholdData.find(
    (t) => t.industry.toLowerCase() === industry.toLowerCase()
  );
  if (!threshold) return 'BLANK';

  const { currentRatioMin, currentRatioMax } = threshold;
  if (currentRatio < currentRatioMin) return 'RED';
  if (currentRatio >= currentRatioMin && currentRatio < currentRatioMax) return 'GREEN';
  return 'ORANGE';
}

export function getPEPercentageColor(peIndustry: number | null): ColorType {
  if (peIndustry === null || !isFinite(peIndustry)) return 'BLANK';
  return peIndustry <= 0 ? 'GREEN' : 'RED';
}

export function getSMAColor(
  price: number | null | undefined,
  smaValue: number | null
): ColorType {
  if (
    price === null ||
    price === undefined ||
    !isFinite(price) ||
    smaValue === null ||
    !isFinite(smaValue)
  ) {
    return 'BLANK';
  }
  if (price > smaValue) return 'GREEN';
  if (price < smaValue) return 'RED';
  return 'ORANGE';
}
