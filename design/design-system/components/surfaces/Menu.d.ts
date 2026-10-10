export interface MenuOption { label: string; selected?: boolean; count?: number; icon?: string; onClick?: () => void; }
export interface MenuProps { options: MenuOption[]; width?: number; multi?: boolean; onDone?: () => void; }
export declare function Menu(props: MenuProps): JSX.Element;
