export interface NotePaperProps {
  children?: React.ReactNode;
  torn?: boolean;
  handle?: boolean;
  padding?: string;
  gap?: number;
  style?: React.CSSProperties;
}
export interface SnapshotProps { src: string; width?: number; height?: number; rotate?: number; }
export declare function NotePaper(props: NotePaperProps): JSX.Element;
export declare function Snapshot(props: SnapshotProps): JSX.Element;
