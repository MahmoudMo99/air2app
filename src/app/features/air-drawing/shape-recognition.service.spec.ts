import { describe, expect, it } from 'vitest';
import { DrawPoint } from './drawing.models';
import { ShapeRecognitionService } from './shape-recognition.service';

function samplePath(vertices: DrawPoint[], stepsPerEdge = 24): DrawPoint[] {
  const points: DrawPoint[] = [];

  for (let i = 1; i < vertices.length; i++) {
    const start = vertices[i - 1];
    const end = vertices[i];

    for (let step = 0; step < stepsPerEdge; step++) {
      const t = step / stepsPerEdge;

      points.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
    }
  }

  points.push({ ...vertices[vertices.length - 1] });

  return points;
}

function createRectangle(width: number, height: number, angle = 0, closed = true): DrawPoint[] {
  const centerX = 450;
  const centerY = 350;
  const radians = (angle * Math.PI) / 180;

  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const corners = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ].map((point) => ({
    x: centerX + point.x * cos - point.y * sin,
    y: centerY + point.x * sin + point.y * cos,
  }));

  if (closed) {
    corners.push({ ...corners[0] });
  }

  return samplePath(corners);
}

function createCircle(radius: number, steps = 120): DrawPoint[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / steps;

    return {
      x: 450 + Math.cos(angle) * radius,
      y: 350 + Math.sin(angle) * radius,
    };
  });
}

function createLine(start: DrawPoint, end: DrawPoint): DrawPoint[] {
  return samplePath([start, end], 48);
}

describe('ShapeRecognitionService', () => {
  const width = 1000;
  const height = 800;

  const recognize = (points: DrawPoint[], pending: DrawPoint[] = []) =>
    new ShapeRecognitionService().recognize(points, pending, width, height);

  it('recognizes a horizontal line', () => {
    const points = createLine({ x: 120, y: 300 }, { x: 650, y: 300 });

    expect(recognize(points)?.kind).toBe('line');
  });

  it('recognizes a diagonal line', () => {
    const points = createLine({ x: 150, y: 180 }, { x: 600, y: 530 });

    expect(recognize(points)?.kind).toBe('line');
  });

  it('recognizes a circle', () => {
    const points = createCircle(115);

    expect(recognize(points)?.kind).toBe('circle');
  });

  it('recognizes an axis-aligned square', () => {
    const points = createRectangle(170, 170);

    expect(recognize(points)?.kind).toBe('square');
  });

  it('recognizes a rotated square', () => {
    const points = createRectangle(170, 170, 35);

    expect(recognize(points)?.kind).toBe('square');
  });

  it('recognizes a square rotated by 45 degrees', () => {
    const points = createRectangle(170, 170, 45);

    expect(recognize(points)?.kind).toBe('square');
  });

  it('recognizes an axis-aligned rectangle', () => {
    const points = createRectangle(260, 120);

    expect(recognize(points)?.kind).toBe('rectangle');
  });

  it('recognizes a rotated rectangle', () => {
    const points = createRectangle(260, 120, 32);

    expect(recognize(points)?.kind).toBe('rectangle');
  });

  it('recognizes a nearly square rectangle as square', () => {
    const points = createRectangle(170, 155, 18);

    expect(recognize(points)?.kind).toBe('square');
  });

  it('preserves the rotation of a recognized square', () => {
    const service = new ShapeRecognitionService();

    const result = service.recognize(createRectangle(170, 170, 35), [], width, height);

    expect(result?.kind).toBe('square');

    if (!result) {
      throw new Error('Expected a recognized square');
    }

    const corners = service.getRectangleCorners(result);

    expect(corners).not.toBeNull();
    expect(corners).toHaveLength(4);

    if (!corners) return;

    const verticalDifference = Math.abs(corners[1].y - corners[0].y);

    expect(verticalDifference).toBeGreaterThan(15);
  });

  it('uses pending points to complete a square', () => {
    const points = createRectangle(180, 180);
    const pending = points.slice(-3);
    const committed = points.slice(0, -3);

    expect(recognize(committed, pending)?.kind).toBe('square');
  });

  it('rejects an incomplete rectangle', () => {
    const points = createRectangle(260, 120, 0, false);

    expect(recognize(points)).toBeNull();
  });

  it('rejects unrelated pending points with a large jump', () => {
    const points = createRectangle(180, 180, 0, false);

    const pending = [
      { x: 980, y: 780 },
      { x: 990, y: 790 },
    ];

    expect(recognize(points, pending)).toBeNull();
  });

  it('does not classify a random zigzag as a geometric shape', () => {
    const points = samplePath([
      { x: 100, y: 180 },
      { x: 230, y: 430 },
      { x: 330, y: 210 },
      { x: 460, y: 500 },
      { x: 580, y: 260 },
      { x: 730, y: 470 },
    ]);

    expect(recognize(points)).toBeNull();
  });

  it('rejects an empty stroke', () => {
    expect(recognize([])).toBeNull();
  });

  it('rejects a very short stroke', () => {
    const points = createLine({ x: 100, y: 100 }, { x: 125, y: 105 });

    expect(recognize(points)).toBeNull();
  });
});
