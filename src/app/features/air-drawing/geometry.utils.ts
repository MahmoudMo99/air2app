import { DrawPoint, ShapeBounds } from './drawing.models';

export function distance(a: DrawPoint, b: DrawPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getBounds(points: DrawPoint[]): ShapeBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function getPathLength(points: DrawPoint[]): number {
  let length = 0;

  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }

  return length;
}

export function smoothPath(points: DrawPoint[]): DrawPoint[] {
  return points.map((_, index) => {
    const from = Math.max(0, index - 2);
    const to = Math.min(points.length - 1, index + 2);
    let x = 0;
    let y = 0;

    for (let i = from; i <= to; i++) {
      x += points[i].x;
      y += points[i].y;
    }

    const count = to - from + 1;
    return { x: x / count, y: y / count };
  });
}

export function resamplePath(points: DrawPoint[], count: number): DrawPoint[] {
  if (points.length < 2) return [...points];

  const cumulative = [0];

  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
  }

  const total = cumulative[cumulative.length - 1];

  if (total <= 0.000001) {
    return Array.from({ length: count }, () => ({ ...points[0] }));
  }

  const result: DrawPoint[] = [];
  let segment = 1;

  for (let i = 0; i < count; i++) {
    const target = (total * i) / (count - 1);

    while (segment < cumulative.length - 1 && cumulative[segment] < target) {
      segment++;
    }

    const from = points[segment - 1];
    const to = points[segment];
    const start = cumulative[segment - 1];
    const length = Math.max(cumulative[segment] - start, 0.000001);
    const t = Math.max(0, Math.min(1, (target - start) / length));

    result.push({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    });
  }

  return result;
}
