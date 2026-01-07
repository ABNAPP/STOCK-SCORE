export interface ColumnMetadata {
  columnKey: string;
  dataSource: string;
  formula?: string;
  conditions?: string[];
  description?: string;
}

export interface TableMetadata {
  tableId: string;
  columns: ColumnMetadata[];
}

