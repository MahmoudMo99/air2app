import { describe, expect, it } from 'vitest';
import { distance, getBounds, getPathLength, resamplePath, smoothPath } from './geometry.utils';

describe('Geometry Utilities', () => {
  describe('distance', () => {
    it('calculates the distance between two points', () => {
      const result = distance({ x: 0, y: 0 }, { x: 3, y: 4 });

      expect(result).toBe(5);
    });

    it('returns zero for identical points', () => {
      const point = { x: 120, y: 80 };

      expect(distance(point, point)).toBe(0);
    });
  });

  describe('getBounds', () => {
    it('calculates the bounding box of a path', () => {
      const result = getBounds([
        { x: -10, y: 5 },
        { x: 20, y: -2 },
        { x: 6, y: 22 },
      ]);

      expect(result).toEqual({
        x: -10,
        y: -2,
        width: 30,
        height: 24,
      });
    });
  });

  describe('getPathLength', () => {
    it('calculates total path length', () => {
      const result = getPathLength([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ]);

      expect(result).toBe(7);
    });

    it('returns zero for a single point', () => {
      expect(getPathLength([{ x: 10, y: 20 }])).toBe(0);
    });
  });

  describe('smoothPath', () => {
    it('reduces an isolated spike', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 40 },
        { x: 30, y: 0 },
        { x: 40, y: 0 },
      ];

      const smoothed = smoothPath(points);

      expect(smoothed).toHaveLength(points.length);
      expect(smoothed[2].y).toBeLessThan(40);
      expect(smoothed[2].y).toBeGreaterThan(0);
    });

    it('does not mutate the original points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 20, y: 0 },
      ];

      const original = points.map((point) => ({
        ...point,
      }));

      smoothPath(points);

      expect(points).toEqual(original);
    });
  });

  describe('resamplePath', () => {
    it('returns the requested number of points', () => {
      const result = resamplePath(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        25,
      );

      expect(result).toHaveLength(25);
    });

    it('preserves the first and last points', () => {
      const result = resamplePath(
        [
          { x: 20, y: 35 },
          { x: 100, y: 50 },
          { x: 220, y: 80 },
        ],
        30,
      );

      expect(result[0]).toEqual({
        x: 20,
        y: 35,
      });

      expect(result[result.length - 1].x).toBeCloseTo(220);
      expect(result[result.length - 1].y).toBeCloseTo(80);
    });

    it('handles a path with zero length', () => {
      const result = resamplePath(
        [
          { x: 50, y: 50 },
          { x: 50, y: 50 },
        ],
        12,
      );

      expect(result).toHaveLength(12);

      for (const point of result) {
        expect(point).toEqual({
          x: 50,
          y: 50,
        });
      }
    });

    it('handles an empty array', () => {
      expect(resamplePath([], 20)).toEqual([]);
    });
  });
});
