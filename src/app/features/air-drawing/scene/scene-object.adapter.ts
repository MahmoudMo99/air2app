import { CompletedStroke, DrawPoint } from '../drawing.models';
import { distance } from '../geometry.utils';
import { NewSceneObject } from './scene.models';

export function toSceneObject(
  stroke: CompletedStroke,
  corners: readonly DrawPoint[] | null = null,
): NewSceneObject | null {
  if (stroke.kind === 'freehand' || stroke.kind === 'line') {
    return null;
  }

  const { x, y, width, height } = stroke.bounds;

  const center = {
    x: x + width / 2,
    y: y + height / 2,
  };

  if (stroke.kind === 'circle') {
    return {
      kind: 'circle',
      center,
      width,
      height,
      rotation: 0,
    };
  }

  if (
    corners?.length === 4 &&
    corners.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  ) {
    const [first, second, third] = corners;

    const edgeWidth = distance(first, second);
    const edgeHeight = distance(second, third);

    if (edgeWidth > 0 && edgeHeight > 0) {
      const side = (edgeWidth + edgeHeight) / 2;

      return {
        kind: stroke.kind,
        center: {
          x: corners.reduce((sum, point) => sum + point.x, 0) / corners.length,
          y: corners.reduce((sum, point) => sum + point.y, 0) / corners.length,
        },
        width: stroke.kind === 'square' ? side : edgeWidth,
        height: stroke.kind === 'square' ? side : edgeHeight,
        rotation: Math.atan2(second.y - first.y, second.x - first.x),
      };
    }
  }

  const side = (width + height) / 2;

  return {
    kind: stroke.kind,
    center,
    width: stroke.kind === 'square' ? side : width,
    height: stroke.kind === 'square' ? side : height,
    rotation: 0,
  };
}
