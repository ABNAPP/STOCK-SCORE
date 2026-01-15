/**
 * Utility functions for print functionality
 */

export interface PrintOptions {
  tableName?: string;
  includeHeader?: boolean;
  includeFooter?: boolean;
  filterInfo?: string;
  rowCount?: number;
  selectedColumns?: string[];
}

/**
 * Formats a date for print headers
 */
export function formatPrintDate(): string {
  return new Date().toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Triggers print dialog for the current page
 */
export function printPage(): void {
  window.print();
}

/**
 * Creates a print preview window
 */
export function createPrintPreview(
  tableElement: HTMLElement | null,
  options: PrintOptions = {}
): Window | null {
  if (!tableElement) {
    console.warn('Table element not found for printing');
    return null;
  }

  const {
    tableName = 'Table',
    includeHeader = true,
    includeFooter = true,
    filterInfo,
    rowCount,
  } = options;

  // Clone the table to avoid modifying the original
  const clonedTable = tableElement.cloneNode(true) as HTMLElement;

  // Remove non-printable elements
  const noPrintElements = clonedTable.querySelectorAll('.no-print, button, [role="button"]');
  noPrintElements.forEach((el) => el.remove());

  // Get the table HTML
  const tableHTML = clonedTable.outerHTML;

  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) {
    console.warn('Could not open print window. Please allow popups.');
    return null;
  }

  // Create print document
  const printDoc = printWindow.document;
  printDoc.open();
  printDoc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${tableName} - ${formatPrintDate()}</title>
        <meta charset="UTF-8">
        <style>
          @page {
            margin: 1.5cm;
            size: A4 landscape;
          }
          
          @media print {
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              font-size: 9pt;
              color: #000;
              background: #fff;
            }
            
            .print-header {
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #000;
            }
            
            .print-header h1 {
              margin: 0 0 5px 0;
              font-size: 16pt;
              font-weight: bold;
            }
            
            .print-header .meta {
              font-size: 9pt;
              color: #333;
              margin-top: 5px;
            }
            
            .print-footer {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px solid #ccc;
              font-size: 8pt;
              color: #666;
              text-align: center;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 0;
              page-break-inside: auto;
            }
            
            thead {
              display: table-header-group;
            }
            
            tbody {
              display: table-row-group;
            }
            
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            
            th, td {
              padding: 6px 8px;
              text-align: left;
              border: 1px solid #ddd;
              font-size: 8pt;
              word-wrap: break-word;
            }
            
            th {
              background-color: #f5f5f5 !important;
              font-weight: bold;
              color: #000 !important;
              position: sticky;
              top: 0;
            }
            
            td {
              background-color: #fff !important;
              color: #000 !important;
            }
            
            /* Remove shadows and backgrounds */
            * {
              box-shadow: none !important;
              background-image: none !important;
            }
            
            /* Hide non-essential elements */
            button, .no-print {
              display: none !important;
            }
            
            /* Ensure full width */
            table {
              min-width: 100% !important;
            }
            
            /* Print-specific optimizations */
            .print-optimized {
              page-break-after: avoid;
            }
          }
          
          @media screen {
            body {
              padding: 20px;
              background: #f5f5f5;
            }
            
            .print-header {
              background: #fff;
              padding: 15px;
              border-radius: 4px;
              margin-bottom: 20px;
            }
            
            .print-footer {
              background: #fff;
              padding: 10px;
              border-radius: 4px;
              margin-top: 20px;
            }
            
            table {
              background: #fff;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
          }
        </style>
      </head>
      <body>
        ${includeHeader ? `
        <div class="print-header">
          <h1>${tableName}</h1>
          <div class="meta">
            <div>Printed: ${formatPrintDate()}</div>
            ${filterInfo ? `<div>Filters: ${filterInfo}</div>` : ''}
            ${rowCount !== undefined ? `<div>Rows: ${rowCount}</div>` : ''}
          </div>
        </div>
        ` : ''}
        ${tableHTML}
        ${includeFooter ? `
        <div class="print-footer">
          <div>${tableName} - Page <span class="page-number"></span></div>
          <div>Printed on ${formatPrintDate()}</div>
        </div>
        ` : ''}
      </body>
    </html>
  `);
  printDoc.close();

  return printWindow;
}

/**
 * Prints a specific table element with enhanced options
 * @param tableElement The table element to print
 * @param tableName Optional name for the print header
 * @param options Additional print options
 */
export function printTable(
  tableElement: HTMLElement | null,
  tableName?: string,
  options: PrintOptions = {}
): void {
  const printWindow = createPrintPreview(tableElement, {
    ...options,
    tableName: tableName || options.tableName || 'Table',
  });

  if (!printWindow) {
    return;
  }

  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}
