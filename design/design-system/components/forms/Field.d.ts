export interface FieldProps {
  label?: string;
  optional?: boolean;
  value?: string;
  placeholder?: string;
  onChange?: (e: any) => void;
  multiline?: boolean;
  height?: number;
  counter?: string;
  max?: number;
}
export interface ToggleProps { on?: boolean; onChange?: (v: boolean) => void; }
export interface CheckboxProps { checked?: boolean; tone?: 'purple' | 'gold'; size?: number; onChange?: (v: boolean) => void; }
export declare function Field(props: FieldProps): JSX.Element;
export declare function Toggle(props: ToggleProps): JSX.Element;
export declare function Checkbox(props: CheckboxProps): JSX.Element;
