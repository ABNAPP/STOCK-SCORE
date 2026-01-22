/**
 * Worker Service
 * 
 * Manages Web Worker instances for data transformation.
 * Provides a unified API for transforming data in workers with fallback to main thread.
 */

import type { DataRow, ProgressCallback } from './sheets/types';

// Check if Web Workers are supported
const WORKERS_SUPPORTED = typeof Worker !== 'undefined';

// Worker instance (singleton pattern)
let workerInstance: Worker | null = null;
let workerLoadPromise: Promise<Worker> | null = null;

// Job counter for unique job IDs
let jobCounter = 0;

// Pending jobs map
const pendingJobs = new Map<string, {
  resolve: (data: unknown[]) => void;
  reject: (error: Error) => void;
  progressCallback?: ProgressCallback;
}>();

/**
 * Load worker instance (lazy loading)
 */
async function loadWorker(): Promise<Worker> {
  if (workerInstance) {
    return workerInstance;
  }

  if (workerLoadPromise) {
    return workerLoadPromise;
  }

  workerLoadPromise = new Promise((resolve, reject) => {
    try {
      // Use Vite's worker import syntax
      // Note: Vite will automatically handle the worker compilation when using new URL()
      const workerUrl = new URL('../workers/dataTransformWorker.ts', import.meta.url);
      const worker = new Worker(workerUrl, { type: 'module' });

      // Set up message handler
      worker.onmessage = (e: MessageEvent) => {
        const message = e.data;

        if (message.type === 'progress') {
          const job = pendingJobs.get(message.jobId);
          if (job?.progressCallback) {
            job.progressCallback({
              stage: message.stage,
              percentage: message.percentage,
              message: message.message,
              rowsProcessed: message.rowsProcessed,
              totalRows: message.totalRows,
            });
          }
        } else if (message.type === 'complete') {
          const job = pendingJobs.get(message.jobId);
          if (job) {
            pendingJobs.delete(message.jobId);
            job.resolve(message.data);
          }
        } else if (message.type === 'error') {
          const job = pendingJobs.get(message.jobId);
          if (job) {
            pendingJobs.delete(message.jobId);
            job.reject(new Error(message.error));
          }
        }
      };

      worker.onerror = (errorEvent) => {
        // Handle worker errors
        // ErrorEvent has: error, message, filename, lineno, colno
        const errorMessage = errorEvent.message || 
                           (errorEvent.error instanceof Error ? errorEvent.error.message : String(errorEvent.error || 'Unknown error')) ||
                           `Worker error at ${errorEvent.filename || 'unknown'}:${errorEvent.lineno || '?'}:${errorEvent.colno || '?'}`;
        
        console.error('Worker error:', {
          message: errorMessage,
          filename: errorEvent.filename,
          lineno: errorEvent.lineno,
          colno: errorEvent.colno,
          error: errorEvent.error,
        });
        
        // Reject the loading promise if worker hasn't been assigned yet (initialization error)
        if (workerInstance !== worker && workerLoadPromise) {
          const currentPromise = workerLoadPromise;
          workerLoadPromise = null;
          currentPromise.catch(() => {}); // Prevent unhandled rejection warning
          reject(new Error(`Failed to load worker: ${errorMessage}`));
          return; // Early return for initialization errors
        }
        
        // Reject all pending jobs
        for (const [jobId, job] of pendingJobs.entries()) {
          pendingJobs.delete(jobId);
          job.reject(new Error(`Worker error: ${errorMessage}`));
        }
        
        // Clean up worker instance
        workerInstance = null;
        workerLoadPromise = null;
      };

      workerInstance = worker;
      resolve(worker);
    } catch (error) {
      workerLoadPromise = null;
      reject(error instanceof Error ? error : new Error('Failed to load worker'));
    }
  });

  return workerLoadPromise;
}

/**
 * Transform data in Web Worker with fallback to main thread
 * 
 * @template T - The type of data returned after transformation
 * @param transformerId - Identifier for the transformer function
 * @param data - Raw data rows to transform
 * @param meta - Metadata about the data (fields)
 * @param progressCallback - Optional callback for progress updates
 * @param additionalData - Additional data needed for some transformers (e.g., ScoreBoard maps)
 * @param fallbackTransformer - Transformer function to use as fallback if worker fails
 * @returns Promise resolving to transformed data
 */
export async function transformInWorker<T>(
  transformerId: string,
  data: DataRow[],
  meta: { fields: string[] | null },
  progressCallback?: ProgressCallback,
  additionalData?: Record<string, unknown>,
  fallbackTransformer?: (results: { data: DataRow[]; meta: { fields: string[] | null } }) => T[]
): Promise<T[]> {
  // Fallback to main thread if workers not supported
  if (!WORKERS_SUPPORTED) {
    return transformInMainThread<T>(transformerId, data, meta, progressCallback, fallbackTransformer);
  }

  try {
    const worker = await loadWorker();
    const jobId = `job-${++jobCounter}`;

    return new Promise<T[]>((resolve, reject) => {
      // Store job info
      pendingJobs.set(jobId, {
        resolve: (data: unknown[]) => resolve(data as T[]),
        reject,
        progressCallback,
      });

      // Send transform message to worker
      worker.postMessage({
        type: 'transform',
        transformerId,
        data,
        meta,
        jobId,
        ...additionalData, // Spread additional data (e.g., industryPe1Map, etc.)
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        if (pendingJobs.has(jobId)) {
          pendingJobs.delete(jobId);
          // Fallback to main thread on timeout
          if (fallbackTransformer) {
            transformInMainThread<T>(transformerId, data, meta, progressCallback, fallbackTransformer)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error('Worker transformation timeout'));
          }
        }
      }, 60000);
    });
  } catch (error) {
    // Fallback to main thread on error
    console.warn('Worker transformation failed, falling back to main thread:', error);
    if (fallbackTransformer) {
      return transformInMainThread<T>(transformerId, data, meta, progressCallback, fallbackTransformer);
    }
    throw error;
  }
}

/**
 * Transform data in main thread (fallback)
 * 
 * This function uses the provided transformer function directly in the main thread.
 * Used as fallback when Workers are not supported or fail.
 */
async function transformInMainThread<T>(
  transformerId: string,
  data: DataRow[],
  meta: { fields: string[] | null },
  progressCallback?: ProgressCallback,
  transformer?: (results: { data: DataRow[]; meta: { fields: string[] | null } }) => T[]
): Promise<T[]> {
  if (!transformer) {
    throw new Error(`Main thread transformation requires transformer function for ${transformerId}`);
  }

  const results = { data, meta };

  try {
    progressCallback?.({
      stage: 'transform',
      percentage: 0,
      message: `Transforming ${transformerId} data (main thread)...`,
      totalRows: data.length,
    });

    const transformedData = transformer(results);

    progressCallback?.({
      stage: 'complete',
      percentage: 100,
      message: 'Transformation complete',
      rowsProcessed: transformedData.length,
      totalRows: transformedData.length,
    });

    return transformedData;
  } catch (error) {
    progressCallback?.({
      stage: 'transform',
      percentage: 0,
      message: `Transformation failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    throw error;
  }
}

/**
 * Map data type name or sheet name to transformer ID
 */
export function getTransformerId(dataTypeName: string, sheetName?: string): string | null {
  const lowerName = dataTypeName.toLowerCase();
  
  if (lowerName.includes('benjamin graham') || lowerName.includes('benjamin-graham')) {
    return 'benjamin-graham';
  }
  if (lowerName.includes('score board') || lowerName.includes('score-board')) {
    return 'score-board';
  }
  if (lowerName.includes('pe industry') || lowerName.includes('pe-industry') || lowerName.includes('p/e industry')) {
    return 'pe-industry';
  }
  if (lowerName.includes('sma')) {
    return 'sma';
  }
  // Threshold Industry requires large industry maps - use main thread instead
  // if (lowerName.includes('threshold industry') || lowerName.includes('threshold-industry')) {
  //   return 'threshold-industry';
  // }
  
  // Try sheet name as fallback
  if (sheetName) {
    const lowerSheet = sheetName.toLowerCase();
    if (lowerSheet === 'sma') {
      return 'sma';
    }
    if (lowerSheet === 'dashboard') {
      // Dashboard can be multiple types, need more context
      return null;
    }
  }
  
  return null;
}

/**
 * Check if Web Workers are supported
 */
export function isWorkerSupported(): boolean {
  return WORKERS_SUPPORTED;
}

/**
 * Terminate worker instance (cleanup)
 */
export function terminateWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    workerLoadPromise = null;
    // Reject all pending jobs
    for (const [jobId, job] of pendingJobs.entries()) {
      pendingJobs.delete(jobId);
      job.reject(new Error('Worker terminated'));
    }
  }
}
