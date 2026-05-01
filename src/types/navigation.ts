export type ViewId =
  | 'score'
  | 'ism-posture-positioning'
  | 'toolbox'
  | 'sma'
  | 'entry-exit-benjamin-graham'
  | 'entry-exit-entry2'
  | 'entry-exit-exit1'
  | 'entry-exit-exit2'
  | 'entry-exit-irr1'
  | 'entry-exit-iv-fcf'
  | 'fundamental-pe-industry'
  | 'fundamental-current-ratio'
  | 'fundamental-cash-sdebt'
  | 'teknikal-tachart'
  | 'industry-threshold'
  | 'stock-analyses'
  | 'under-development'
  | 'stock-monitor'
  | 'management-monitoring'
  | 'personal-portfolio';

export interface NavigationItem {
  id: ViewId;
  label: string;
  children?: NavigationItem[];
}

export interface NavigationSection {
  id: string;
  label: string;
  items: NavigationItem[];
  collapsible?: boolean;
}
