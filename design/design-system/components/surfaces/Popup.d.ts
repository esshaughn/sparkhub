export interface PopupProps {
  open?: boolean;
  title: string;
  sub?: string;
  onClose?: () => void;
  children?: React.ReactNode;
  /** Render just the card (no scrim) — for docs and stacking. */
  inline?: boolean;
}
export declare function Popup(props: PopupProps): JSX.Element | null;
