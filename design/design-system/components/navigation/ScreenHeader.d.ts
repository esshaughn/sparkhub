export interface ScreenHeaderProps {
  title: string;
  tile?: React.ReactNode;
  tileColor?: string;
  back?: boolean;
  onBack?: () => void;
  sparkles?: boolean;
  bellCount?: number;
  actions?: boolean;
}
export declare function ScreenHeader(props: ScreenHeaderProps): JSX.Element;
