export interface ChipProps {
  children?: React.ReactNode;
  selected?: boolean;
  /** md 38px · sm 36px (list filter row) · xs 32px (time chips) */
  size?: 'md' | 'sm' | 'xs';
  /** Picked colour: ink (default), purple (time chips), gold (idea forms) */
  tone?: 'ink' | 'purple' | 'gold';
  /** Dashed "+ Date" / "+ Location" add chips */
  dashed?: boolean;
  onClick?: () => void;
}
export interface ChipRowProps { children?: React.ReactNode; style?: React.CSSProperties; }
export declare function Chip(props: ChipProps): JSX.Element;
export declare function ChipRow(props: ChipRowProps): JSX.Element;
