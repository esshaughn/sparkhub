export interface WordmarkProps {
  tone?: 'dark' | 'light';
  /** Bolt stacked over the word, BETA underneath (loading splash). */
  stacked?: boolean;
  size?: number;
}
export declare function Wordmark(props: WordmarkProps): JSX.Element;
