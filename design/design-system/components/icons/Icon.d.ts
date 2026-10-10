export interface IconProps {
  /** One of ICON_NAMES: chevron-right, close, check, plus, calendar, bulb, bell, search, pin, people, person, person-plus, lock, link, share, qr, edit, trash, gear, megaphone, heart, chat, comment, clock, poll, tag, camera, image, info, more, warning, sparkle (filled), bolt (filled)… */
  name: string;
  size?: number;
  color?: string;
  /** v8 uses 1.9 (tab bar, bell), 2.2 (default), 2.6–2.8 (chevrons, ×), 3.2–4 (ticks in small circles). */
  strokeWidth?: number;
  title?: string;
  style?: React.CSSProperties;
}
export declare const ICON_NAMES: string[];
export declare function Icon(props: IconProps): JSX.Element | null;
