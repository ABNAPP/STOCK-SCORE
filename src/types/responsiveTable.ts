import { ReactNode } from 'react';

export interface ColumnConfig {
  key: string;
  label: string;
  required?: boolean;
  defaultVisible?: boolean;
}

export interface ResponsiveTableWrapperProps<T> {
  // Primära kolumner (alltid synliga på små skärmar)
  primaryColumns: ColumnConfig[];
  // Sekundära kolumner (i expanderbart kort)
  secondaryColumns: ColumnConfig[];
  // Data
  data: T[];
  // Render-funktioner
  renderPrimaryCell: (item: T, column: ColumnConfig, index: number) => ReactNode;
  renderSecondaryContent: (item: T, index: number) => ReactNode;
  // Befintliga funktioner
  onRowClick?: (item: T) => void;
  // Styling
  rowClassName?: (item: T, index: number) => string;
  // Table header rendering
  renderTableHeader?: () => ReactNode;
  // Empty state
  emptyMessage?: string;
  // Loading state
  isLoading?: boolean;
}

export interface ExpandedRowState {
  [key: string]: boolean;
}

