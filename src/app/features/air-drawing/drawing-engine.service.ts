import { Injectable, inject, signal } from '@angular/core';
import { CompletedStroke, DrawPoint } from './drawing.models';
import { distance, getPathLength } from './geometry.utils';
import { toSceneObject } from './scene/scene-object.adapter';
import { SceneRenderer } from './scene/scene.renderer';
import { SceneStore } from './scene/scene.store';
import { ShapeRecognitionService } from './shape-recognition.service';

type RenderEntry =
  | {
      type: 'stroke';
      stroke: CompletedStroke;
    }
  | {
      type: 'object';
      id: string;
    };

@Injectable()
export class DrawingEngineService {
  readonly strokeCount = signal(0);
  readonly lastShape = signal('No strokes yet');

  private readonly recognizer = inject(ShapeRecognitionService);
  private readonly scene = inject(SceneStore);
  private readonly sceneRenderer = inject(SceneRenderer);

  private readonly smoothingFactor = 0.4;
  private readonly maxJumpRatio = 0.16;
  private readonly trailingBufferSize = 3;
  private readonly strokeColor = '#52f5d0';
  private readonly strokeWidth = 5;

  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;

  private currentPoints: DrawPoint[] = [];
  private pendingPoints: DrawPoint[] = [];
  private renderEntries: RenderEntry[] = [];

  private lastDrawPoint: DrawPoint | null = null;
  private smoothedPoint: DrawPoint | null = null;
  private lastRawPoint: DrawPoint | null = null;
  private selectionVisible = false;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
  }

  resize(width: number, height: number): void {
    if (
      !this.canvas ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return;
    }

    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;

    this.clear();
  }

  setSelectionVisible(visible: boolean): void {
    if (this.selectionVisible === visible) {
      return;
    }

    this.selectionVisible = visible;
    this.redraw();
  }

  beginStroke(): void {
    if (this.currentPoints.length >= 2 || this.pendingPoints.length >= 2) {
      this.finishStroke();
    }

    this.resetCurrentStroke();
  }

  draw(x: number, y: number): void {
    if (
      !this.canvas?.width ||
      !this.canvas.height ||
      !this.context ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    const rawPoint: DrawPoint = {
      x: Math.max(0, Math.min(1, x)) * this.canvas.width,
      y: Math.max(0, Math.min(1, y)) * this.canvas.height,
    };

    if (this.lastRawPoint) {
      const jump = distance(rawPoint, this.lastRawPoint);

      const threshold = Math.hypot(this.canvas.width, this.canvas.height) * this.maxJumpRatio;

      if (jump > threshold) {
        this.finishStroke();
      }
    }

    this.lastRawPoint = rawPoint;

    const point: DrawPoint = this.smoothedPoint
      ? {
          x: this.smoothedPoint.x + (rawPoint.x - this.smoothedPoint.x) * this.smoothingFactor,
          y: this.smoothedPoint.y + (rawPoint.y - this.smoothedPoint.y) * this.smoothingFactor,
        }
      : rawPoint;

    this.smoothedPoint = point;
    this.pendingPoints.push(point);

    if (this.pendingPoints.length <= this.trailingBufferSize) {
      return;
    }

    const safePoint = this.pendingPoints.shift();

    if (!safePoint) {
      return;
    }

    if (!this.lastDrawPoint) {
      this.lastDrawPoint = safePoint;
      this.currentPoints.push(safePoint);
      return;
    }

    if (distance(safePoint, this.lastDrawPoint) < 0.8) {
      return;
    }

    this.applyStrokeStyle(this.context);

    this.context.beginPath();
    this.context.moveTo(this.lastDrawPoint.x, this.lastDrawPoint.y);

    this.context.lineTo(safePoint.x, safePoint.y);

    this.context.stroke();
    this.context.shadowBlur = 0;

    this.currentPoints.push(safePoint);
    this.lastDrawPoint = safePoint;
  }

  finishStroke(): void {
    if (!this.canvas) {
      this.resetCurrentStroke();
      return;
    }

    const points = this.collectFinalPoints();

    if (points.length < 2 || getPathLength(points) < 8) {
      this.resetCurrentStroke();
      this.redraw();
      return;
    }

    const recognized = this.recognizer.recognize(points, [], this.canvas.width, this.canvas.height);

    const corners =
      recognized?.kind === 'rectangle' || recognized?.kind === 'square'
        ? this.recognizer.getRectangleCorners(recognized)
        : null;

    const sceneObject = recognized ? toSceneObject(recognized, corners) : null;

    if (sceneObject) {
      const added = this.scene.addObject(sceneObject);

      this.renderEntries.push({
        type: 'object',
        id: added.id,
      });
    } else {
      const stroke: CompletedStroke = recognized ?? {
        kind: 'freehand',
        points,
      };

      this.renderEntries.push({
        type: 'stroke',
        stroke,
      });
    }

    this.strokeCount.set(this.renderEntries.length);

    this.lastShape.set(this.formatShape(recognized?.kind ?? 'freehand'));

    this.resetCurrentStroke();
    this.redraw();
  }

  refreshScene(): void {
    this.redraw();
  }

  clear(): void {
    this.renderEntries = [];
    this.scene.clear();

    this.strokeCount.set(0);
    this.lastShape.set('No strokes yet');

    this.resetCurrentStroke();

    if (!this.canvas || !this.context) {
      return;
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private collectFinalPoints(): DrawPoint[] {
    const points = [...this.currentPoints];

    if (!this.canvas) {
      return points;
    }

    const maxStep = Math.max(
      24,
      Math.min(58, Math.hypot(this.canvas.width, this.canvas.height) * 0.045),
    );

    for (const point of this.pendingPoints) {
      const previous = points[points.length - 1];

      if (previous && distance(previous, point) > maxStep) {
        break;
      }

      if (!previous || distance(previous, point) >= 0.8) {
        points.push(point);
      }
    }

    return points;
  }

  private redraw(): void {
    if (!this.canvas || !this.context) {
      return;
    }

    const ctx = this.context;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const sceneObjects = new Map(this.scene.objects().map((object) => [object.id, object]));

    for (const entry of this.renderEntries) {
      if (entry.type === 'object') {
        const object = sceneObjects.get(entry.id);

        if (!object) {
          continue;
        }

        this.sceneRenderer.render(ctx, object, this.strokeColor, this.strokeWidth);

        continue;
      }

      this.renderStroke(ctx, entry.stroke);
    }

    this.renderActiveStroke(ctx);

    if (this.selectionVisible) {
      const selected = this.scene.selectedObject();

      if (selected) {
        this.sceneRenderer.renderSelection(ctx, selected);
      }
    }
  }

  private renderActiveStroke(ctx: CanvasRenderingContext2D): void {
    if (this.currentPoints.length < 2) {
      return;
    }

    this.applyStrokeStyle(ctx);
    ctx.beginPath();

    ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);

    for (let i = 1; i < this.currentPoints.length; i++) {
      ctx.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private renderStroke(ctx: CanvasRenderingContext2D, stroke: CompletedStroke): void {
    this.applyStrokeStyle(ctx);
    ctx.beginPath();

    if (stroke.kind === 'freehand') {
      if (stroke.points.length < 2) {
        ctx.shadowBlur = 0;
        return;
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
    } else if (stroke.kind === 'line') {
      ctx.moveTo(stroke.start.x, stroke.start.y);

      ctx.lineTo(stroke.end.x, stroke.end.y);
    } else if (stroke.kind === 'rectangle' || stroke.kind === 'square') {
      const corners = this.recognizer.getRectangleCorners(stroke);

      if (corners && corners.length === 4) {
        ctx.moveTo(corners[0].x, corners[0].y);

        for (let i = 1; i < corners.length; i++) {
          ctx.lineTo(corners[i].x, corners[i].y);
        }

        ctx.closePath();
      } else {
        const { x, y, width, height } = stroke.bounds;

        ctx.roundRect(x, y, width, height, Math.min(12, width / 8, height / 8));
      }
    } else if (stroke.kind === 'circle') {
      const { x, y, width } = stroke.bounds;

      ctx.arc(x + width / 2, y + width / 2, width / 2, 0, Math.PI * 2);
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private applyStrokeStyle(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.shadowColor = this.strokeColor;
    ctx.shadowBlur = 14;
  }

  private formatShape(kind: CompletedStroke['kind']): string {
    return kind === 'freehand' ? 'Freehand' : kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  private resetCurrentStroke(): void {
    this.lastDrawPoint = null;
    this.smoothedPoint = null;
    this.lastRawPoint = null;
    this.currentPoints = [];
    this.pendingPoints = [];
  }
}
