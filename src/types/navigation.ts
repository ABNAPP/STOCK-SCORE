export type ViewId =
  | 'score'
  | 'score-board'
  | 'entry-exit-benjamin-graham'
  | 'entry-exit-entry2'
  | 'entry-exit-exit1'
  | 'entry-exit-exit2'
  | 'entry-exit-irr1'
  | 'entry-exit-iv-fcf'
  | 'fundamental-pe-industry'
  | 'fundamental-current-ratio'
  | 'fundamental-cash-sdebt'
  | 'fundamental-ro40-cy'
  | 'fundamental-ro40-f1'
  | 'fundamental-ro40-f2'
  | 'teknikal-tachart'
  | 'threshold-industry'
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
