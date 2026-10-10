export interface IconButtonProps {
  icon: string;
  label: string;
  /** grey (#f2f3f6 header buttons) · white (× on paper) · frosted (over photos) · dark (frosted ink) · ghost (back) */
  variant?: 'grey' | 'white' | 'frosted' | 'dark' | 'ghost';
  size?: number;
  iconSize?: number;
  badge?: string | number;
  onClick?: (e: any) => void;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
