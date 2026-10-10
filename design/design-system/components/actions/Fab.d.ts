export interface FabProps {
  /** plus (purple, opens + menu) · idea (gold, Ideas tab) · settings (white, Me) */
  variant?: 'plus' | 'idea' | 'settings';
  open?: boolean;
  floating?: boolean;
  onClick?: () => void;
}
export interface PlusMenuPillProps { kind?: 'plan' | 'idea'; onClick?: () => void; }
export declare function Fab(props: FabProps): JSX.Element;
export declare function PlusMenuPill(props: PlusMenuPillProps): JSX.Element;
