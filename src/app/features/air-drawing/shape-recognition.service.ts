import { Injectable } from '@angular/core';
import { CompletedStroke, DrawPoint } from './drawing.models';
import { distance, getBounds, getPathLength, resamplePath, smoothPath } from './geometry.utils';

interface OrientedFrame {
  cos: number;
  sin: number;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  width: number;
  height: number;
}

@Injectable()
export class ShapeRecognitionService {
  private readonly rectangleCorners = new WeakMap<CompletedStroke, DrawPoint[]>();

  recognize(
    points: DrawPoint[],
    pending: DrawPoint[],
    canvasWidth: number,
    canvasHeight: number,
  ): CompletedStroke | null {
    if (points.length < 2) return null;

    const candidate = this.appendPendingPoints(points, pending, canvasWidth, canvasHeight);

    const recognized = this.tryRecognize(candidate);

    if (recognized) return recognized;

    if (candidate.length !== points.length) {
      return this.tryRecognize(points);
    }

    return null;
  }

  getRectangleCorners(stroke: CompletedStroke): readonly DrawPoint[] | null {
    return this.rectangleCorners.get(stroke) ?? null;
  }

  private tryRecognize(points: DrawPoint[]): CompletedStroke | null {
    return (
      this.recognizeLine(points) ?? this.recognizeRectangle(points) ?? this.recognizeCircle(points)
    );
  }

  private appendPendingPoints(
    points: DrawPoint[],
    pending: DrawPoint[],
    canvasWidth: number,
    canvasHeight: number,
  ): DrawPoint[] {
    const result = [...points];

    const maxStep = Math.max(24, Math.min(58, Math.hypot(canvasWidth, canvasHeight) * 0.045));

    for (const point of pending) {
      const previous = result[result.length - 1];

      if (previous && distance(previous, point) > maxStep) {
        break;
      }

      if (!previous || distance(previous, point) >= 0.8) {
        result.push(point);
      }
    }

    return result;
  }

  private recognizeRectangle(points: DrawPoint[]): CompletedStroke | null {
    if (points.length < 12) return null;

    const samples = resamplePath(smoothPath(points), 96);

    if (samples.length < 12) return null;

    const frame = this.findOrientedFrame(samples);

    if (!frame) return null;

    const { width, height } = frame;
    const diagonal = Math.hypot(width, height);

    if (width < 42 || height < 42 || diagonal < 90) {
      return null;
    }

    const endpointGap = distance(samples[0], samples[samples.length - 1]);

    const maxGap = Math.max(25, Math.min(60, diagonal * 0.27));

    if (endpointGap > maxGap) return null;

    const pathLength = getPathLength(samples);
    const perimeter = 2 * (width + height);

    if (pathLength < perimeter * 0.7 || pathLength > perimeter * 1.55) {
      return null;
    }

    const minAlong = [Infinity, Infinity, Infinity, Infinity];

    const maxAlong = [-Infinity, -Infinity, -Infinity, -Infinity];

    const cornerDistances = [Infinity, Infinity, Infinity, Infinity];

    const corners = [
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 1, v: 1 },
      { u: 0, v: 1 },
    ];

    let totalEdgeError = 0;
    let supportedPoints = 0;

    const edgeTolerance = 0.135;

    for (const point of samples) {
      const projected = this.project(point, frame);

      const u = (projected.u - frame.minU) / frame.width;

      const v = (projected.v - frame.minV) / frame.height;

      const edgeDistances = [Math.abs(v), Math.abs(1 - v), Math.abs(u), Math.abs(1 - u)];

      const nearestEdge = Math.min(...edgeDistances);

      totalEdgeError += nearestEdge;

      if (nearestEdge <= edgeTolerance) {
        supportedPoints++;
      }

      for (let i = 0; i < 4; i++) {
        if (edgeDistances[i] > edgeTolerance) {
          continue;
        }

        const position = i < 2 ? u : v;

        minAlong[i] = Math.min(minAlong[i], position);

        maxAlong[i] = Math.max(maxAlong[i], position);
      }

      for (let i = 0; i < corners.length; i++) {
        const corner = corners[i];

        cornerDistances[i] = Math.min(cornerDistances[i], Math.hypot(u - corner.u, v - corner.v));
      }
    }

    const meanEdgeError = totalEdgeError / samples.length;

    const supportRatio = supportedPoints / samples.length;

    const sideCoverage = minAlong.map((minimum, index) => {
      if (!Number.isFinite(minimum)) {
        return 0;
      }

      return maxAlong[index] - minimum;
    });

    const hasFourSides = sideCoverage.every((coverage) => coverage >= 0.7);

    const hasFourCorners = cornerDistances.every((cornerDistance) => cornerDistance <= 0.19);

    if (meanEdgeError > 0.11 || supportRatio < 0.74 || !hasFourSides || !hasFourCorners) {
      return null;
    }

    const aspectRatio = Math.max(width, height) / Math.min(width, height);

    const isSquare = aspectRatio <= 1.22;

    const resultCorners = this.buildRectangleCorners(frame, isSquare);

    const bounds = getBounds(resultCorners);

    const recognized: CompletedStroke = isSquare
      ? { kind: 'square', bounds }
      : { kind: 'rectangle', bounds };

    this.rectangleCorners.set(recognized, resultCorners);

    return recognized;
  }

  private recognizeCircle(points: DrawPoint[]): CompletedStroke | null {
    if (points.length < 12) return null;

    const samples = resamplePath(smoothPath(points), 96);

    if (samples.length < 12) return null;

    const { x, y, width, height } = getBounds(samples);

    if (width < 45 || height < 45) {
      return null;
    }

    const aspectRatio = width / height;

    if (aspectRatio < 0.73 || aspectRatio > 1.36) {
      return null;
    }

    const diagonal = Math.hypot(width, height);

    const endpointGap = distance(samples[0], samples[samples.length - 1]);

    const maxGap = Math.max(25, Math.min(60, diagonal * 0.27));

    if (endpointGap > maxGap) {
      return null;
    }

    const pathLength = getPathLength(samples);

    const circumference = (Math.PI * (width + height)) / 2;

    if (pathLength < circumference * 0.76 || pathLength > circumference * 1.45) {
      return null;
    }

    const centerX = x + width / 2;
    const centerY = y + height / 2;

    let radialError = 0;
    let totalAngle = 0;
    let previousAngle: number | null = null;

    for (const point of samples) {
      const normalizedX = (point.x - centerX) / (width / 2);

      const normalizedY = (point.y - centerY) / (height / 2);

      const radius = Math.hypot(normalizedX, normalizedY);

      radialError += Math.abs(radius - 1);

      const angle = Math.atan2(normalizedY, normalizedX);

      if (previousAngle !== null) {
        const delta = angle - previousAngle;

        totalAngle += Math.atan2(Math.sin(delta), Math.cos(delta));
      }

      previousAngle = angle;
    }

    radialError /= samples.length;

    if (radialError > 0.16) {
      return null;
    }

    const rotation = Math.abs(totalAngle);

    if (rotation < Math.PI * 1.5 || rotation > Math.PI * 2.5) {
      return null;
    }

    const diameter = (width + height) / 2;

    return {
      kind: 'circle',
      bounds: {
        x: centerX - diameter / 2,
        y: centerY - diameter / 2,
        width: diameter,
        height: diameter,
      },
    };
  }

  private recognizeLine(points: DrawPoint[]): CompletedStroke | null {
    if (points.length < 4) return null;

    const samples = resamplePath(smoothPath(points), 50);

    if (samples.length < 4) return null;

    const start = samples[0];
    const end = samples[samples.length - 1];

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    const directDistance = Math.hypot(dx, dy);

    if (directDistance < 65) {
      return null;
    }

    const pathLength = getPathLength(samples);

    if (pathLength > directDistance * 1.4) {
      return null;
    }

    let totalDeviation = 0;
    let maxDeviation = 0;

    for (const point of samples) {
      const deviation =
        Math.abs(dy * (point.x - start.x) - dx * (point.y - start.y)) / directDistance;

      totalDeviation += deviation;

      maxDeviation = Math.max(maxDeviation, deviation);
    }

    const meanDeviation = totalDeviation / samples.length;

    if (
      meanDeviation > Math.max(8, directDistance * 0.065) ||
      maxDeviation > Math.max(17, directDistance * 0.14)
    ) {
      return null;
    }

    const snappedStart = { ...start };
    const snappedEnd = { ...end };

    if (Math.abs(dy) < Math.abs(dx) * 0.13) {
      const centerY = (start.y + end.y) / 2;

      snappedStart.y = centerY;
      snappedEnd.y = centerY;
    } else if (Math.abs(dx) < Math.abs(dy) * 0.13) {
      const centerX = (start.x + end.x) / 2;

      snappedStart.x = centerX;
      snappedEnd.x = centerX;
    }

    return {
      kind: 'line',
      start: snappedStart,
      end: snappedEnd,
    };
  }

  private findOrientedFrame(points: DrawPoint[]): OrientedFrame | null {
    const hull = this.convexHull(points);

    if (hull.length < 3) return null;

    let bestFrame: OrientedFrame | null = null;
    let bestArea = Infinity;

    for (let i = 0; i < hull.length; i++) {
      const start = hull[i];
      const end = hull[(i + 1) % hull.length];

      const angle = Math.atan2(end.y - start.y, end.x - start.x);

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      let minU = Infinity;
      let maxU = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;

      for (const point of points) {
        const u = point.x * cos + point.y * sin;

        const v = -point.x * sin + point.y * cos;

        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
      }

      const width = maxU - minU;
      const height = maxV - minV;
      const area = width * height;

      if (width <= 0 || height <= 0 || area >= bestArea) {
        continue;
      }

      bestArea = area;

      bestFrame = {
        cos,
        sin,
        minU,
        maxU,
        minV,
        maxV,
        width,
        height,
      };
    }

    return bestFrame;
  }

  private convexHull(points: DrawPoint[]): DrawPoint[] {
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

    const unique: DrawPoint[] = [];

    for (const point of sorted) {
      const previous = unique[unique.length - 1];

      if (!previous || distance(previous, point) > 0.001) {
        unique.push(point);
      }
    }

    if (unique.length < 3) {
      return unique;
    }

    const cross = (origin: DrawPoint, a: DrawPoint, b: DrawPoint): number =>
      (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);

    const lower: DrawPoint[] = [];

    for (const point of unique) {
      while (
        lower.length >= 2 &&
        cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
      ) {
        lower.pop();
      }

      lower.push(point);
    }

    const upper: DrawPoint[] = [];

    for (let i = unique.length - 1; i >= 0; i--) {
      const point = unique[i];

      while (
        upper.length >= 2 &&
        cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
      ) {
        upper.pop();
      }

      upper.push(point);
    }

    lower.pop();
    upper.pop();

    return [...lower, ...upper];
  }

  private project(point: DrawPoint, frame: OrientedFrame): { u: number; v: number } {
    return {
      u: point.x * frame.cos + point.y * frame.sin,
      v: -point.x * frame.sin + point.y * frame.cos,
    };
  }

  private buildRectangleCorners(frame: OrientedFrame, isSquare: boolean): DrawPoint[] {
    let minU = frame.minU;
    let maxU = frame.maxU;
    let minV = frame.minV;
    let maxV = frame.maxV;

    if (isSquare) {
      const centerU = (minU + maxU) / 2;

      const centerV = (minV + maxV) / 2;

      const halfSide = (frame.width + frame.height) / 4;

      minU = centerU - halfSide;
      maxU = centerU + halfSide;
      minV = centerV - halfSide;
      maxV = centerV + halfSide;
    }

    const localCorners = [
      { u: minU, v: minV },
      { u: maxU, v: minV },
      { u: maxU, v: maxV },
      { u: minU, v: maxV },
    ];

    return localCorners.map(({ u, v }) => ({
      x: u * frame.cos - v * frame.sin,
      y: u * frame.sin + v * frame.cos,
    }));
  }
}
