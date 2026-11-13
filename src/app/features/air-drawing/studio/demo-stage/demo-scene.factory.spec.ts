import { describe, expect, it } from 'vitest';
import { createDemoScene } from './demo-scene.factory';

describe('Demo Scene Factory', () => {
  it('creates three interactive demo shapes', () => {
    const objects = createDemoScene(1000, 600);

    expect(objects).toHaveLength(3);

    expect(objects.map((object) => object.kind)).toEqual(['circle', 'square', 'rectangle']);

    expect(objects.every((object) => object.width > 0 && object.height > 0)).toBe(true);
  });

  it('positions the shapes inside different viewport sizes', () => {
    for (const [width, height] of [
      [1000, 600],
      [360, 400],
      [1920, 1080],
    ]) {
      const objects = createDemoScene(width, height);

      for (const object of objects) {
        expect(object.center.x).toBeGreaterThan(0);
        expect(object.center.x).toBeLessThan(width);
        expect(object.center.y).toBeGreaterThan(0);
        expect(object.center.y).toBeLessThan(height);
      }
    }
  });
});
