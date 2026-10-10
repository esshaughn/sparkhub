/** @startingPoint section="Surfaces" subtitle="Slide-up sheet with grab handle" viewport="393x600" */
export interface BottomSheetProps {
  open?: boolean;
  title: string;
  eyebrow?: string;
  eyebrowColor?: string;
  top?: number;
  onClose?: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}
export declare function BottomSheet(props: BottomSheetProps): JSX.Element | null;
