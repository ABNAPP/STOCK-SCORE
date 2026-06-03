import type { IsmSectorIndexDto } from './ismSectorApi';

export type IsmSectorDailySeriesApiResponse = {
  sectorId: string;
  from: string;
  to: string;
  rows: IsmSectorIndexDto[];
};
