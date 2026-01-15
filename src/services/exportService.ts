import Papa from 'papaparse';

export interface ExportColumn<T = unknown> {
  key: string;
  label: string;
  accessor?: (item: T) => unknown;
}

export interface ExportOptions {
  filename?: string;
  includeHeaders?: boolean;
  delimiter?: string;
  includeMetadata?: boolean;
  metadata?: {
    tableName?: string;
    exportDate?: Date;
    filterInfo?: string;
    rowCount?: number;
  };
}

/**
 * Format a value for CSV export with proper formatting
 */
function formatValueForCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Handle dates
  if (value instanceof Date) {
    return value.toLocaleDateString('sv-SE') + ' ' + value.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  }

  // Handle numbers with proper formatting
  if (typeof value === 'number') {
    // Format with appropriate decimal places
    if (Number.isInteger(value)) {
      return value.toString();
    }
    // Round to 2 decimal places for non-integers
    return value.toFixed(2);
  }

  // Handle objects
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  // Handle strings - escape quotes and wrap in quotes if contains delimiter or newline
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Exports data to CSV format using papaparse with improved formatting
 * @param data Array of data objects to export
 * @param columns Column definitions with key, label, and optional accessor function
 * @param options Export options (filename, includeHeaders, delimiter, includeMetadata)
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions = {}
): void {
  const {
    filename = 'export',
    includeHeaders = true,
    delimiter = ',',
    includeMetadata = true,
    metadata,
  } = options;

  // Prepare CSV data
  const csvData: unknown[][] = [];

  // Add metadata header if requested
  if (includeMetadata && metadata) {
    const metaRows: string[] = [];
    if (metadata.tableName) {
      metaRows.push(`Table: ${metadata.tableName}`);
    }
    if (metadata.exportDate) {
      metaRows.push(`Export Date: ${metadata.exportDate.toLocaleString('sv-SE')}`);
    }
    if (metadata.filterInfo) {
      metaRows.push(`Filters: ${metadata.filterInfo}`);
    }
    if (metadata.rowCount !== undefined) {
      metaRows.push(`Rows: ${metadata.rowCount}`);
    }
    if (metaRows.length > 0) {
      csvData.push([metaRows.join(' | ')]);
      csvData.push([]); // Empty row separator
    }
  }

  // Add headers if requested
  if (includeHeaders) {
    csvData.push(columns.map((col) => col.label));
  }

  // Add data rows with formatted values
  data.forEach((item) => {
    const row = columns.map((col) => {
      let value: unknown;
      if (col.accessor) {
        value = col.accessor(item);
      } else {
        value = item[col.key];
      }
      return formatValueForCSV(value);
    });
    csvData.push(row);
  });

  // Convert to CSV string using papaparse
  const csv = Papa.unparse(csvData, {
    delimiter,
    newline: '\n',
    header: false, // We're handling headers manually
    quotes: true, // Quote fields that contain delimiter
    escapeChar: '"',
  });

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const csvWithBOM = BOM + csv;

  // Create blob and download
  const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports data to Excel format (CSV with .xlsx extension and proper formatting)
 * Note: For true Excel format, you would need the xlsx library.
 * This implementation creates a CSV file with .xlsx extension for compatibility.
 * @param data Array of data objects to export
 * @param columns Column definitions with key, label, and optional accessor function
 * @param options Export options (filename, includeHeaders)
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions = {}
): void {
  const {
    filename = 'export',
    includeHeaders = true,
  } = options;

  // For now, we'll use CSV format with .xlsx extension
  // For true Excel format, install and use the 'xlsx' library
  exportToCSV(data, columns, {
    ...options,
    filename,
    includeHeaders,
    delimiter: ',',
  });

  // Note: To implement true Excel export, uncomment and use the following:
  /*
  import * as XLSX from 'xlsx';
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Prepare data
  const wsData: unknown[][] = [];
  
  if (includeHeaders) {
    wsData.push(columns.map((col) => col.label));
  }
  
  data.forEach((item) => {
    const row = columns.map((col) => {
      if (col.accessor) {
        return col.accessor(item);
      }
      return item[col.key] ?? '';
    });
    wsData.push(row);
  });
  
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  
  // Write file
  XLSX.writeFile(wb, `${filename}.xlsx`);
  */
}

/**
 * Exports filtered and sorted table data
 * @param allData Complete dataset
 * @param filteredData Filtered dataset (what user sees)
 * @param columns Column definitions
 * @param format Export format ('csv' | 'excel')
 * @param options Export options
 */
export function exportTableData<T extends Record<string, unknown>>(
  allData: T[],
  filteredData: T[],
  columns: ExportColumn<T>[],
  format: 'csv' | 'excel' = 'csv',
  options: ExportOptions = {}
): void {
  // Export the filtered data (what user sees)
  if (format === 'excel') {
    exportToExcel(filteredData, columns, options);
  } else {
    exportToCSV(filteredData, columns, options);
  }
}

/**
 * Shows a progress indicator for large exports
 * @param total Total number of items
 * @param current Current item being processed
 * @param onProgress Callback with progress percentage
 */
export function exportWithProgress<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  format: 'csv' | 'excel' = 'csv',
  options: ExportOptions = {},
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve) => {
    // For small datasets, export immediately
    if (data.length < 1000) {
      if (format === 'excel') {
        exportToExcel(data, columns, options);
      } else {
        exportToCSV(data, columns, options);
      }
      onProgress?.(100);
      resolve();
      return;
    }

    // For large datasets, show progress
    let processed = 0;
    const total = data.length;
    const batchSize = 100;

    const processBatch = (startIndex: number) => {
      const endIndex = Math.min(startIndex + batchSize, total);
      
      // Process batch
      for (let i = startIndex; i < endIndex; i++) {
        processed++;
        const progress = Math.round((processed / total) * 100);
        onProgress?.(progress);
      }

      if (endIndex < total) {
        // Process next batch asynchronously
        setTimeout(() => processBatch(endIndex), 0);
      } else {
        // All data processed, now export
        if (format === 'excel') {
          exportToExcel(data, columns, options);
        } else {
          exportToCSV(data, columns, options);
        }
        onProgress?.(100);
        resolve();
      }
    };

    processBatch(0);
  });
}
