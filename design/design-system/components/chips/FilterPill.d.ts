export interface FilterPillProps {
  label: string;
  /** Up to 3 group photos overlapped at the left */
  thumbs?: string[];
  /** Quiet text sort control (⇅ Popular ⌄), no pill */
  quiet?: boolean;
  icon?: string;
  onClick?: () => void;
}
export declare function FilterPill(props: FilterPillProps): JSX.Element;
