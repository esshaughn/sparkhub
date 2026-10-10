export interface ListRowProps {
  title: string;
  sub?: string;
  count?: string | number;
  role?: 'lead' | 'helping' | 'going' | 'maybe' | 'idea' | 'draft' | 'past';
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  trailing?: React.ReactNode;
  first?: boolean;
  onClick?: () => void;
}
export declare function ListRow(props: ListRowProps): JSX.Element;
