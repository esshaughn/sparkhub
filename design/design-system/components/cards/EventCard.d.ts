/** @startingPoint section="Cards" subtitle="Event photo card with role strip" viewport="700x420" */
export interface EventCardProps {
  photo: string;
  dateLine: string;
  title: string;
  place?: string;
  role?: 'lead' | 'helping' | 'going' | 'maybe' | 'open' | 'idea';
  stripLeft?: string;
  stripRight?: string;
  countdown?: string;
  today?: boolean;
  priv?: boolean;
  height?: number;
  onClick?: () => void;
}
export declare function EventCard(props: EventCardProps): JSX.Element;
