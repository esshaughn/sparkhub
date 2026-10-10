export interface SparklesProps {
  /** card (All groups) · header (Ideas header, coloured) · pill (Your impact) · soft (Start here) · button (Make it a Plan!, Post it) */
  preset?: 'card' | 'header' | 'pill' | 'soft' | 'button';
  /** Custom placements: [left%, top%, size, colour, opacity] or ['dot', left%, top%, size, opacity] */
  items?: any[];
}
export interface SparkleProps { size?: number; color?: string; style?: React.CSSProperties; }
export declare function Sparkles(props: SparklesProps): JSX.Element;
export declare function Sparkle(props: SparkleProps): JSX.Element;
