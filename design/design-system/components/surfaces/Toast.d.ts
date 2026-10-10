export interface ToastProps {
  children?: React.ReactNode;
  kind?: 'ok' | 'soon' | 'err';
  action?: string;
  onAction?: () => void;
  floating?: boolean;
}
export declare function Toast(props: ToastProps): JSX.Element;
