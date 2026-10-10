export interface GradientCardProps {
  kind?: 'allGroups' | 'startHere' | 'impact';
  title?: string;
  sub?: string;
  thumbs?: string[];
  /** impact: [[4,'led'],[6,'helped'],[2,'attended']] */
  stats?: [number | string, string][];
  onClick?: () => void;
}
export declare function GradientCard(props: GradientCardProps): JSX.Element;
