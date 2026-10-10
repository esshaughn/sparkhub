export interface CardProps {
  children?: React.ReactNode;
  tone?: 'white' | 'empty' | 'goldTop' | 'goldSoft' | 'dark';
  radius?: number;
  padding?: number | string;
  gap?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export interface SectionLabelProps { children?: React.ReactNode; color?: string; }
export declare function Card(props: CardProps): JSX.Element;
export declare function SectionLabel(props: SectionLabelProps): JSX.Element;
