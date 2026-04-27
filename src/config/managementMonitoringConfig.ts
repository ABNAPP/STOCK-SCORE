import type { ManagementMonitoringConfig } from '../types/managementMonitoring';
import { ENTRY_EXIT_COLUMN_LABELS } from '../constants/entryExitColumnLabels';

export const managementMonitoringConfig: ManagementMonitoringConfig = {
  pageTitle: 'MANAGEMENT MONITORING',
  pageSubtitle:
    'Overview of central data service status and monitoring tables',

  cards: [
    {
      id: 'central-data-service',
      number: 1,
      title: 'Central Data Service',
      theme: 'amber',
      icon: 'CircleStackIcon',
      description:
        'Shows the status of the shared Google Sheets snapshot layer used by the app.',
      gridSpan: 2,
    },
  ],

  tables: [
    {
      id: 'stocks-green-entry',
      title: 'STOCK WITH GREEN ENTRY',
      dataSource: 'stocksGreenEntry' as const,
      columns: [
        { key: 'no', label: 'No.' },
        { key: 'companyName', label: 'Company Name' },
        { key: 'ticker', label: 'Ticker' },
        { key: 'currency', label: 'Currency' },
        { key: 'price', label: 'Price' },
        { key: 'entry1', label: ENTRY_EXIT_COLUMN_LABELS.entry1 },
        { key: 'entry2', label: ENTRY_EXIT_COLUMN_LABELS.entry2 },
      ],
      rows: [],
    },
    {
      id: 'summary-actions',
      title: 'Summary – Actions',
      columns: [
        { key: 'action', label: 'Action' },
        { key: 'owner', label: 'Owner' },
        { key: 'due', label: 'Due' },
      ],
      rows: [
        { action: 'Review Q2 goals', owner: 'Team lead', due: '2025-04-15' },
        { action: 'Update workflows', owner: 'Ops', due: '2025-03-20' },
        { action: 'Stakeholder report', owner: 'PM', due: '2025-03-14' },
      ],
    },
  ],
};
