import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
  output,
} from '@angular/core';
import { DrawPoint, GestureFrame } from '../../drawing.models';
import { distance } from '../../geometry.utils';
import { ObjectInteractionController } from '../../scene/object-interaction.controller';
import { SceneRenderer } from '../../scene/scene.renderer';
import { SceneStore } from '../../scene/scene.store';
import { createDemoScene } from './demo-scene.factory';

@Component({
  selector: 'app-demo-stage',
  imports: [],
  templateUrl: './demo-stage.html',
  styleUrl: './demo-stage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoStage implements AfterViewInit, OnDestroy {
  @ViewChild('demoCanvas')
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly scene = inject(SceneStore);
  private readonly renderer = inject(SceneRenderer);
  private readonly interaction = inject(ObjectInteractionController);

  readonly interactionEnded = output<void>();
  readonly isDragging = this.interaction.isDragging;

  private resizeObserver: ResizeObserver | null = null;
  private context: CanvasRenderingContext2D | null = null;

  private viewportWidth = 0;
  private viewportHeight = 0;
  private pixelRatio = 1;

  private pointerId: number | null = null;
  private lastPointer: DrawPoint | null = null;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
      });

      this.resizeObserver.observe(canvas);
    }

    this.resizeCanvas();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.cancelPointer();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.canvasRef) {
      return;
    }

    this.resizeCanvas();
  }

  reset(): void {
    if (!this.viewportWidth || !this.viewportHeight) {
      return;
    }

    this.cancelPointer();
    this.scene.clear();

    for (const object of createDemoScene(this.viewportWidth, this.viewportHeight)) {
      this.scene.addObject(object);
    }

    this.scene.clearSelection();
    this.render();
  }

  cancelPointer(): void {
    if (this.pointerId === null) {
      return;
    }

    const canvas = this.canvasRef.nativeElement;

    if (canvas.hasPointerCapture(this.pointerId)) {
      canvas.releasePointerCapture(this.pointerId);
    }

    this.pointerId = null;
    this.lastPointer = null;

    this.interaction.cancel();
    this.render();
  }

  onPointerDown(event: PointerEvent): void {
    if (
      this.pointerId !== null ||
      !event.isPrimary ||
      event.button !== 0 ||
      !this.viewportWidth ||
      !this.viewportHeight
    ) {
      return;
    }

    const point = this.getPointerPosition(event);

    if (!point) {
      return;
    }

    event.preventDefault();

    this.pointerId = event.pointerId;
    this.lastPointer = point;

    this.canvasRef.nativeElement.setPointerCapture(event.pointerId);

    this.interaction.handle(
      this.createGesture('start', point),
      this.viewportWidth,
      this.viewportHeight,
    );

    this.render();
  }

  onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId || !this.lastPointer) {
      return;
    }

    const next = this.getPointerPosition(event);

    if (!next) {
      return;
    }

    event.preventDefault();

    const previous = this.lastPointer;
    const movement = distance(previous, next);

    const maxStep = Math.hypot(this.viewportWidth, this.viewportHeight) * 0.06;

    const steps = Math.max(1, Math.ceil(movement / Math.max(1, maxStep)));

    let changed = false;

    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;

      const point: DrawPoint = {
        x: previous.x + (next.x - previous.x) * progress,
        y: previous.y + (next.y - previous.y) * progress,
      };

      const result = this.interaction.handle(
        this.createGesture('draw', point),
        this.viewportWidth,
        this.viewportHeight,
      );

      changed = result || changed;
    }

    this.lastPointer = next;

    if (changed) {
      this.render();
    }
  }

  onPointerEnd(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    this.interaction.handle(
      {
        active: false,
        action: 'end',
        cursor: null,
      },
      this.viewportWidth,
      this.viewportHeight,
    );

    this.cancelPointer();
    this.interactionEnded.emit();
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;

    const width = Math.round(canvas.clientWidth);

    const height = Math.round(canvas.clientHeight);

    if (width <= 0 || height <= 0) {
      return;
    }

    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    const pixelWidth = Math.round(width * ratio);

    const pixelHeight = Math.round(height * ratio);

    if (
      width === this.viewportWidth &&
      height === this.viewportHeight &&
      ratio === this.pixelRatio &&
      canvas.width === pixelWidth &&
      canvas.height === pixelHeight &&
      this.context
    ) {
      return;
    }

    this.cancelPointer();

    const previousWidth = this.viewportWidth;
    const previousHeight = this.viewportHeight;

    const dimensionsChanged = width !== previousWidth || height !== previousHeight;

    this.viewportWidth = width;
    this.viewportHeight = height;
    this.pixelRatio = ratio;

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    this.context = canvas.getContext('2d');

    if (!this.context) {
      return;
    }

    if (!previousWidth || !previousHeight) {
      this.reset();
      return;
    }

    if (dimensionsChanged) {
      this.scene.resizeViewport(previousWidth, previousHeight, width, height);
    }

    this.render();
  }

  private getPointerPosition(event: PointerEvent): DrawPoint | null {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();

    if (
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height) ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return null;
    }

    return {
      x: Math.max(
        0,
        Math.min(
          this.viewportWidth,
          ((event.clientX - rect.left) / rect.width) * this.viewportWidth,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          this.viewportHeight,
          ((event.clientY - rect.top) / rect.height) * this.viewportHeight,
        ),
      ),
    };
  }

  private createGesture(action: 'start' | 'draw', point: DrawPoint): GestureFrame {
    return {
      active: true,
      action,
      cursor: {
        x: point.x / this.viewportWidth,
        y: point.y / this.viewportHeight,
      },
    };
  }

  private render(): void {
    const ctx = this.context;

    if (!ctx) {
      return;
    }

    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    const colors = {
      circle: '#52f5d0',
      square: '#90aaff',
      rectangle: '#ffc78a',
    } as const;

    for (const object of this.scene.objects()) {
      this.renderer.render(ctx, object, colors[object.kind], 4);
    }

    const selected = this.scene.selectedObject();

    if (selected) {
      this.renderer.renderSelection(ctx, selected);
    }
  }

  getViewport(): {
    width: number;
    height: number;
  } | null {
    if (this.viewportWidth <= 0 || this.viewportHeight <= 0) {
      return null;
    }

    return {
      width: this.viewportWidth,
      height: this.viewportHeight,
    };
  }

  refresh(): void {
    this.render();
  }
}
