/** @startingPoint section="Actions" subtitle="Pill buttons: purple, gold, green, ink, gradient" viewport="700x320" */
export interface ButtonProps {
  children?: React.ReactNode;
  /** primary purple · gold (ideas) · green (going/done) · ink · white · outline (Sign up) · outlineGold (Share on ideas) · soft · pink (Post update) · gradient (Make it a Plan!) · text · danger */
  variant?: 'primary' | 'gold' | 'green' | 'ink' | 'white' | 'outline' | 'outlineGold' | 'soft' | 'pink' | 'gradient' | 'text' | 'danger';
  /** lg 54px · md 48px · sm 36px */
  size?: 'lg' | 'md' | 'sm';
  icon?: string;
  iconRight?: string;
  full?: boolean;
  /** Grey #d5d8df with white text (e.g. Post it before there's a title + date). */
  disabled?: boolean;
  sparkles?: boolean;
  onClick?: (e: any) => void;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
