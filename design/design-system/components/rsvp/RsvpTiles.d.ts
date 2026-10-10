export interface RsvpTilesProps { value?: 'going' | 'maybe' | 'no' | null; onPick?: (v: 'going' | 'maybe' | 'no') => void; }
export interface RsvpStatusProps { value?: 'going' | 'maybe' | 'no' | 'lead'; label?: string; onChange?: () => void; }
export declare function RsvpTiles(props: RsvpTilesProps): JSX.Element;
export declare function RsvpStatus(props: RsvpStatusProps): JSX.Element;
