import { describe, expect, it } from 'vitest';
import { DrawPoint } from '../drawing.models';
import { toSceneObject } from './scene-object.adapter';

describe('Scene Object Adapter', () => {
  it('ignores strokes that are not interactive shapes', () => {
    expect(
      toSceneObject({
        kind: 'line',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
      }),
    ).toBeNull();
  });

  it('converts a circle into a scene object', () => {
    const object = toSceneObject({
      kind: 'circle',
      bounds: {
        x: 100,
        y: 200,
        width: 120,
        height: 120,
      },
    });

    expect(object).toEqual({
      kind: 'circle',
      center: { x: 160, y: 260 },
      width: 120,
      height: 120,
      rotation: 0,
    });
  });

  it('preserves a rotated rectangle transformation', () => {
    const angle = Math.PI / 6;
    const center = { x: 400, y: 300 };

    const rotate = (x: number, y: number): DrawPoint => ({
      x: center.x + x * Math.cos(angle) - y * Math.sin(angle),
      y: center.y + x * Math.sin(angle) + y * Math.cos(angle),
    });

    const corners = [rotate(-100, -50), rotate(100, -50), rotate(100, 50), rotate(-100, 50)];

    const object = toSceneObject(
      {
        kind: 'rectangle',
        bounds: {
          x: 260,
          y: 200,
          width: 280,
          height: 200,
        },
      },
      corners,
    );

    expect(object?.kind).toBe('rectangle');
    expect(object?.center.x).toBeCloseTo(400);
    expect(object?.center.y).toBeCloseTo(300);
    expect(object?.width).toBeCloseTo(200);
    expect(object?.height).toBeCloseTo(100);
    expect(object?.rotation).toBeCloseTo(angle);
  });

  it('uses bounds when rectangle corners are unavailable', () => {
    const object = toSceneObject({
      kind: 'square',
      bounds: {
        x: 100,
        y: 150,
        width: 140,
        height: 140,
      },
    });

    expect(object).toEqual({
      kind: 'square',
      center: { x: 170, y: 220 },
      width: 140,
      height: 140,
      rotation: 0,
    });
  });
});
