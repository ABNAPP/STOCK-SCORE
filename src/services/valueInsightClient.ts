/**
 * HTTP client for value-insight-be (VITE_API_BASE_URL).
 * Add new backend endpoints here as the API grows.
 */

import type { User } from 'firebase/auth';
import { auth } from '../config/firebase';
import type { MainDataApiErrorBody, MainDataApiResponse } from '../types/mainDataApi';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function getValueInsightApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not configured');
  }
  return API_BASE_URL;
}

export async function getValueInsightFirebaseIdToken(user?: User): Promise<string> {
  const resolved = user ?? auth.currentUser;
  if (!resolved) {
    throw new Error('Must be signed in');
  }
  return resolved.getIdToken();
}

async function parseJsonResponse<T>(res: Response, apiLabel: string): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    throw new Error(`Invalid JSON response from ${apiLabel}`);
  }

  if (!res.ok) {
    const errBody = body as MainDataApiErrorBody;
    const message =
      typeof errBody?.error === 'string'
        ? errBody.error
        : `HTTP ${res.status}: ${res.statusText}`;
    if (res.status === 401) {
      throw new Error(`Unauthorized: ${message}`);
    }
    if (res.status === 403) {
      throw new Error(`Forbidden: ${message}`);
    }
    throw new Error(message);
  }

  return body as T;
}

async function valueInsightGet<T>(path: string, apiLabel: string): Promise<T> {
  const base = getValueInsightApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return parseJsonResponse<T>(res, apiLabel);
}

async function valueInsightPost<T>(
  path: string,
  apiLabel: string,
  options: { user?: User; authRequired?: boolean }
): Promise<T> {
  const base = getValueInsightApiBaseUrl();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.authRequired !== false) {
    const token = await getValueInsightFirebaseIdToken(options.user);
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${base}${path}`, { method: 'POST', headers });
  return parseJsonResponse<T>(res, apiLabel);
}

// --- Main data (dashboard cache) ---

/** GET /main-data — cached dashboard data (server refreshes when stale). */
export async function fetchMainData(): Promise<MainDataApiResponse> {
  return valueInsightGet<MainDataApiResponse>('/main-data', 'main-data');
}

/** POST /main-data/refresh — force refresh (admin Firebase ID token required). */
export async function refreshMainData(user?: User): Promise<MainDataApiResponse> {
  return valueInsightPost<MainDataApiResponse>('/main-data/refresh', 'main-data', { user });
}
