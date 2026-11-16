import { DrawPoint, GestureFrame } from './drawing.models';

export function mapGestureToCanvas(gesture: GestureFrame): GestureFrame {
  const cursor = gesture.cursor;

  if (!cursor) {
    return gesture;
  }

  if (!Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) {
    return {
      ...gesture,
      cursor: null,
    };
  }

  const mappedCursor: DrawPoint = {
    x: 1 - clamp01(cursor.x),
    y: clamp01(cursor.y),
  };

  return {
    ...gesture,
    cursor: mappedCursor,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
