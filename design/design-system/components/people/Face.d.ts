export interface FaceProps { src?: string; name?: string; size?: number; ring?: boolean; grey?: boolean; }
export interface FaceStackProps { faces: FaceProps[]; size?: number; max?: number; label?: string; }
export declare function Face(props: FaceProps): JSX.Element;
export declare function FaceStack(props: FaceStackProps): JSX.Element;
