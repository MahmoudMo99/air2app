import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { ObjectInteractionController } from '../scene/object-interaction.controller';
import { SceneRenderer } from '../scene/scene.renderer';
import { SceneStore } from '../scene/scene.store';
import { LivingObjectsMotion } from './living-objects.motion';
import { SceneEffectsEngine } from './scene-effects.engine';

@Component({
  selector: 'app-scene-effects',
  imports: [],
  templateUrl: './scene-effects.html',
  styleUrl: './scene-effects.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneEffects implements AfterViewInit, OnDestroy {
  @ViewChild('effectsCanvas')
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly referenceCanvas = input<HTMLCanvasElement | null>(null);
  readonly mirrored = input(false);
  readonly ambientEnabled = input(true);
  readonly physicsActive = input(false);

  readonly sceneFrame = output<void>();
  readonly physicsFrame = output<number>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly scene = inject(SceneStore);
  private readonly interaction = inject(ObjectInteractionController);
  private readonly sceneRenderer = inject(SceneRenderer);
  private readonly livingMotion = inject(LivingObjectsMotion);
  private readonly zone = inject(NgZone);

  private readonly engine = new SceneEffectsEngine(this.sceneRenderer);

  private readonly motionQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  private reducedMotion = this.motionQuery?.matches ?? false;

  private context: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frameId: number | null = null;

  private viewportWidth = 0;
  private viewportHeight = 0;
  private pixelRatio = 1;
  private lastAmbientFrame = Number.NEGATIVE_INFINITY;
  private hadVisibleEffects = false;
  private destroyed = false;

  private readonly onMotionPreferenceChanged = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;

    if (this.reducedMotion) {
      this.engine.clearAnimations();
    }

    this.syncScene();
  };

  constructor() {
    this.motionQuery?.addEventListener?.('change', this.onMotionPreferenceChanged);

    effect(() => {
      this.syncScene();
    });
  }

  ngAfterViewInit(): void {
    this.context = this.canvasRef.nativeElement.getContext('2d');

    if (!this.context) {
      return;
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
        this.scheduleFrame();
      });

      this.resizeObserver.observe(this.host.nativeElement);
    }

    this.resizeCanvas();
    this.scheduleFrame();
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    this.resizeObserver?.disconnect();

    this.motionQuery?.removeEventListener?.('change', this.onMotionPreferenceChanged);

    this.cancelFrame();

    this.livingMotion.setActive(false, performance.now());

    this.engine.reset();
  }

  private syncScene(): void {
    if (this.destroyed) {
      return;
    }

    const objects = this.scene.objects();
    const selected = this.scene.selectedObject();
    const tool = this.interaction.tool();
    const dragging = this.interaction.isDragging();
    const ambientEnabled = this.ambientEnabled();

    const reference = this.referenceCanvas();

    const width = reference ? reference.width : this.host.nativeElement.clientWidth;

    const height = reference ? reference.height : this.host.nativeElement.clientHeight;

    const now = performance.now();

    this.engine.sync(
      {
        objects,
        selected,
        tool,
        dragging,
        now,
        maxJump: Math.max(70, Math.hypot(width, height) * 0.12),
      },
      this.reducedMotion,
    );

    const shouldFloat = !this.reducedMotion && ambientEnabled && !dragging && objects.length > 0;

    const changed = this.livingMotion.setActive(shouldFloat, now);

    if (changed) {
      this.lastAmbientFrame = Number.NEGATIVE_INFINITY;
      this.sceneFrame.emit();
    }

    if (this.needsAnimationFrame()) {
      this.resizeCanvas();
      this.scheduleFrame();
    } else {
      this.cancelFrame();

      if (this.hadVisibleEffects) {
        this.clearCanvas();
        this.hadVisibleEffects = false;
      }
    }
  }

  private needsAnimationFrame(): boolean {
    return this.engine.hasActiveEffects() || this.livingMotion.isActive || this.physicsActive();
  }

  private scheduleFrame(): void {
    if (this.destroyed || this.frameId !== null || !this.context || !this.needsAnimationFrame()) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.frameId = requestAnimationFrame(this.drawFrame);
    });
  }

  private readonly drawFrame = (timestamp: number): void => {
    this.frameId = null;

    if (this.destroyed) {
      return;
    }

    this.resizeCanvas();

    if (this.physicsActive()) {
      this.physicsFrame.emit(timestamp);
    }

    this.engine.expire(timestamp);

    if (this.livingMotion.isActive && timestamp - this.lastAmbientFrame >= 50) {
      this.livingMotion.advance(timestamp, this.viewportHeight);

      this.lastAmbientFrame = timestamp;
      this.sceneFrame.emit();
    }

    const hasEffects = this.engine.hasActiveEffects();

    if (hasEffects || this.hadVisibleEffects) {
      this.clearCanvas();
      this.hadVisibleEffects = hasEffects;

      if (hasEffects && this.context && this.viewportWidth > 0 && this.viewportHeight > 0) {
        this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

        this.engine.render(this.context, this.scene.objects(), timestamp);
      }
    }

    this.scheduleFrame();
  };

  private resizeCanvas(): void {
    if (!this.context) {
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    const reference = this.referenceCanvas();

    const width = Math.round(reference ? reference.width : this.host.nativeElement.clientWidth);

    const height = Math.round(reference ? reference.height : this.host.nativeElement.clientHeight);

    if (width <= 0 || height <= 0) {
      return;
    }

    const ratio = reference ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);

    if (
      canvas.width === pixelWidth &&
      canvas.height === pixelHeight &&
      this.viewportWidth === width &&
      this.viewportHeight === height
    ) {
      return;
    }

    if (this.viewportWidth > 0 && this.viewportHeight > 0) {
      this.engine.clearAnimations();
    }

    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    this.viewportWidth = width;
    this.viewportHeight = height;
    this.pixelRatio = ratio;
    this.hadVisibleEffects = false;
  }

  private clearCanvas(): void {
    if (!this.context || !this.canvasRef) {
      return;
    }

    const canvas = this.canvasRef.nativeElement;

    this.context.setTransform(1, 0, 0, 1, 0, 0);

    this.context.clearRect(0, 0, canvas.width, canvas.height);
  }

  private cancelFrame(): void {
    if (this.frameId === null) {
      return;
    }

    cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }
}
