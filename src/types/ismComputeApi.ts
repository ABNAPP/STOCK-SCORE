/** Response from ISM compute POST routes (`/ism/sectors/:id/rebalance`, daily-index, run-all). */

export type IsmComputeStepResult = {
  step: string;
  status: 'ok' | 'failed' | 'warn';
  detail: string;
};

export type IsmComputeApiResponse = {
  sectorId?: string;
  ok: boolean;
  tradeDate?: string;
  rebalanceDate?: string;
  qualifiedCount?: number;
  constituentCount?: number;
  syncedCount?: number;
  errors?: string[];
  steps?: IsmComputeStepResult[];
};
