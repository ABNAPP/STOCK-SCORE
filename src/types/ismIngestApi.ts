import type { ISMInstrumentIngest, ISMIngestSummary } from './ismIngest';

export type IsmIngestApiResponse = {
  rows: ISMInstrumentIngest[];
  summary: ISMIngestSummary;
  entryExitCompanyNames: string[];
};
