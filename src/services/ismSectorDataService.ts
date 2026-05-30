import { fetchIsmSectorDetailFromApi } from './valueInsightClient';
import type { IsmSectorDetailApiResponse } from '../types/ismSectorApi';

export async function loadIsmSectorDetail(sectorId: string): Promise<IsmSectorDetailApiResponse> {
  const trimmed = sectorId.trim();
  if (!trimmed) {
    throw new Error('sectorId is required');
  }
  return fetchIsmSectorDetailFromApi(trimmed);
}
