/**
 * Application Constants
 * 
 * This file contains all magic numbers and hardcoded values used throughout
 * the application. These constants have descriptive names to improve code
 * readability and maintainability.
 */

// Price tolerance multipliers
export const PRICE_TOLERANCE_GREEN = 1.05; // 5% above entry/benjamin graham
export const PRICE_TOLERANCE_BLUE = 1.15; // 15% above benjamin graham

// Return rate thresholds (percentages)
export const RR1_GREEN_THRESHOLD_PERCENT = 60;
export const RR2_GREEN_THRESHOLD_PERCENT = 90;

// Munger Quality Score thresholds
export const MUNGER_QUALITY_SCORE_RED_THRESHOLD = 40;
export const MUNGER_QUALITY_SCORE_GREEN_THRESHOLD = 60;

// Date thresholds (days)
export const DATE_NEAR_OLD_THRESHOLD_DAYS = 30;

// Color factors
export const COLOR_FACTOR_GREEN = 1.00;
export const COLOR_FACTOR_ORANGE_BLUE = 0.70;

// TB/S Price threshold
export const TB_S_PRICE_GREEN_THRESHOLD = 1.00;

