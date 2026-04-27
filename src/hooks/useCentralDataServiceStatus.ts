import { useEffect, useState } from 'react';
import {
  getSheetSnapshotStatus,
  subscribeSheetSnapshotStatus,
  type SheetSnapshotStatus,
} from '../services/sheets/sheetSnapshotService';

/**
 * Read-only hook for central sheet snapshot service status.
 * Does not trigger any Google Sheets / Apps Script fetches.
 */
export function useCentralDataServiceStatus(): SheetSnapshotStatus {
  const [status, setStatus] = useState<SheetSnapshotStatus>(() => getSheetSnapshotStatus());

  useEffect(() => {
    const unsubscribe = subscribeSheetSnapshotStatus((nextStatus) => {
      setStatus(nextStatus);
    });
    return unsubscribe;
  }, []);

  return status;
}
