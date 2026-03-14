import type { ManagementMonitoringConfig } from '../types/managementMonitoring';

export const managementMonitoringConfig: ManagementMonitoringConfig = {
  pageTitle: 'MANAGEMENT MONITORING',
  pageSubtitle:
    'Overview of goals, workflows, tools, memory, context and reporting',

  cards: [
    {
      id: 'goals',
      number: 1,
      title: 'Goals',
      theme: 'blue',
      icon: 'FlagIcon',
      items: [
        'Strategic objectives alignment',
        'KPIs and targets',
        'Progress tracking',
      ],
      gridSpan: 1,
    },
    {
      id: 'workflows',
      number: 2,
      title: 'Workflows',
      theme: 'red',
      icon: 'ArrowsRightLeftIcon',
      items: [
        'Process documentation',
        'Approval chains',
        'Automation triggers',
      ],
      gridSpan: 1,
    },
    {
      id: 'tools',
      number: 3,
      title: 'Tools',
      theme: 'amber',
      icon: 'WrenchScrewdriverIcon',
      description:
        'Integrated systems, dashboards and tooling used for daily operations and reporting.',
      gridSpan: 2,
    },
    {
      id: 'memory',
      number: 4,
      title: 'Memory',
      theme: 'green',
      icon: 'CircleStackIcon',
      items: [
        'Historical decisions',
        'Context retention',
        'Knowledge base',
      ],
      gridSpan: 1,
    },
    {
      id: 'context',
      number: 5,
      title: 'Context',
      theme: 'blue',
      icon: 'DocumentTextIcon',
      items: [
        'Current priorities',
        'Stakeholder view',
        'Environmental factors',
      ],
      gridSpan: 1,
    },
    {
      id: 'reporting',
      number: 6,
      title: 'Reporting',
      theme: 'red',
      icon: 'ChartBarIcon',
      description:
        'Regular reports, status updates and dashboards for stakeholders and leadership.',
      gridSpan: 1,
    },
    {
      id: 'review',
      number: 7,
      title: 'Review & Feedback',
      theme: 'green',
      icon: 'ArrowPathIcon',
      items: [
        'Retrospectives',
        'Feedback loops',
        'Continuous improvement',
      ],
      gridSpan: 1,
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
        { key: 'entry1', label: 'Entry1' },
        { key: 'entry2', label: 'Entry2' },
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
