export interface TabBarProps {
  active?: 'groups' | 'friends' | 'calendar' | 'ideas' | 'me';
  onChange?: (k: string) => void;
  dots?: Record<string, boolean>;
  floating?: boolean;
}
export declare function TabBar(props: TabBarProps): JSX.Element;
