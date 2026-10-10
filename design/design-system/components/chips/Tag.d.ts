export interface TagProps {
  kind?: 'request' | 'beta' | 'idea' | 'ideaPaper' | 'update' | 'lead' | 'plan' | 'private' | 'frosted' | 'today' | 'count' | 'cancelled';
  children?: React.ReactNode;
  icon?: string;
}
export declare function Tag(props: TagProps): JSX.Element;
