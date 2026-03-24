export type ViewId =
  | 'score'
  | 'score-board'
  | 'ism-posture-positioning'
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
