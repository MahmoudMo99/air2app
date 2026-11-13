export interface DrawPoint {
  x: number;
  y: number;
}

export interface ShapeBounds extends DrawPoint {
  width: number;
  height: number;
}

export type ShapeKind = 'rectangle' | 'square' | 'circle';

export type CompletedStroke =
  | { kind: 'freehand'; points: DrawPoint[] }
  | { kind: 'line'; start: DrawPoint; end: DrawPoint }
  | { kind: ShapeKind; bounds: ShapeBounds };

export interface GestureFrame {
  active: boolean;
  action: 'idle' | 'start' | 'draw' | 'pause' | 'end';
  cursor: DrawPoint | null;
}
