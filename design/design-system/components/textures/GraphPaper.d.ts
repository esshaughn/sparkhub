export interface GraphPaperProps {
  children?: React.ReactNode;
  variant?: 'sheet' | 'board';
  rotate?: number;
  padding?: string;
  gap?: number;
  style?: React.CSSProperties;
}
export declare function GraphPaper(props: GraphPaperProps): JSX.Element;
