/** Theme for monitoring cards – maps to pastell Tailwind backgrounds/borders */
export type CardTheme = 'blue' | 'red' | 'amber' | 'green';

export interface MonitoringCardConfig {
  id: string;
  number: number;
  title: string;
  theme: CardTheme;
  icon?: string;
  /** Bullet list items; if set, description is ignored */
  items?: string[];
  /** Plain text description when items are not used */
  description?: string;
  /** Grid span on desktop (1 = one column, 2 = two columns) */
  gridSpan?: 1 | 2;
}

export interface MonitoringTableColumn {
  key: string;
  label: string;
}

/** When set, rows are computed by the page; config rows are ignored */
export type MonitoringTableDataSource = 'stocksGreenEntry';

export interface MonitoringTableConfig {
  id: string;
  title: string;
  columns: MonitoringTableColumn[];
  /** Ignored when dataSource is set */
  rows: Record<string, string | number>[];
  dataSource?: MonitoringTableDataSource;
}

export interface ManagementMonitoringConfig {
  pageTitle: string;
  pageSubtitle: string;
  cards: MonitoringCardConfig[];
  tables: MonitoringTableConfig[];
}
