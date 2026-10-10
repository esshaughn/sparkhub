export interface IdeaCardProps {
  variant?: 'tile' | 'grid';
  title: string;
  description?: string;
  by: string;
  count: string | number;
  photo?: string;
  priv?: boolean;
  rotate?: number;
  onClick?: () => void;
}
export declare function IdeaCard(props: IdeaCardProps): JSX.Element;
