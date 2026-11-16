import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DrawingEngineService } from '../drawing-engine.service';
import { LivingObjectsMotion } from '../effects/living-objects.motion';
import { SceneEffects } from '../effects/scene-effects';
import { HandTrackingService } from '../hand-tracking.service';
import { PhysicsViewport, ScenePhysicsEngine } from '../physics/scene-physics.engine';
import { PinchGesture } from '../pinch-gesture';
import { ObjectInteractionController } from '../scene/object-interaction.controller';
import { InteractionTool } from '../scene/scene.models';
import { SceneRenderer } from '../scene/scene.renderer';
import { SceneStore } from '../scene/scene.store';
import { ShapeRecognitionService } from '../shape-recognition.service';
import { DemoStage } from './demo-stage/demo-stage';
import { InteractionGuide } from './interaction-guide/interaction-guide';

type InteractionMode = 'draw' | 'interact';
type DisplayMode = 'canvas' | 'overlay';
@Component({
  selector: 'app-studio',
  imports: [InteractionGuide, DemoStage, SceneEffects],
  templateUrl: './studio.html',
  styleUrl: './studio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    HandTrackingService,
    ShapeRecognitionService,
    SceneStore,
    SceneRenderer,
    LivingObjectsMotion,
    ObjectInteractionController,
    DrawingEngineService,
  ],
})
export class Studio implements OnDestroy {
  @ViewChild('camera')
  private cameraRef!: ElementRef<HTMLVideoElement>;

  @ViewChild('drawingCanvas')
  private drawingRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('overlay')
  private overlayRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('stageShell')
  private stageRef!: ElementRef<HTMLElement>;

  @ViewChild('cameraSurface')
  private cameraSurfaceRef!: ElementRef<HTMLElement>;

  @ViewChild('stageFooter')
  private stageFooterRef!: ElementRef<HTMLElement>;

  @ViewChild(DemoStage)
  private demoStage?: DemoStage;

  private readonly tracking = inject(HandTrackingService);
  private readonly drawing = inject(DrawingEngineService);
  private readonly scene = inject(SceneStore);
  private readonly interaction = inject(ObjectInteractionController);
  private readonly sceneRenderer = inject(SceneRenderer);
  private readonly livingMotion = inject(LivingObjectsMotion);
  private readonly gesture = new PinchGesture();

  private readonly physicsEngine = new ScenePhysicsEngine();
  private lastPhysicsTimestamp: number | null = null;

  readonly isLoading = signal(false);
  readonly isRunning = signal(false);
  readonly isDemo = signal(false);
  readonly isActive = computed(() => this.isRunning() || this.isDemo());

  readonly handCount = signal(0);
  readonly isPinching = signal(false);
  readonly isFullscreen = signal(false);
  readonly isFullscreenFallback = signal(false);
  readonly error = signal('');

  readonly interactionMode = signal<InteractionMode>('draw');
  readonly displayMode = signal<DisplayMode>('canvas');
  readonly cameraPreviewVisible = signal(true);
  readonly waitingForRelease = signal(false);
  readonly hasTransformedObject = signal(false);

  readonly physicsEnabled = signal(false);
  readonly physicsAwake = signal(false);

  readonly interactionTool = this.interaction.tool;
  readonly isDragging = this.interaction.isDragging;

  readonly strokeCount = this.drawing.strokeCount;
  readonly lastShape = this.drawing.lastShape;
  readonly selectedObject = this.scene.selectedObject;

  readonly sceneCount = computed(() => this.scene.objects().length);

  private stream: MediaStream | null = null;
  private frameId: number | null = null;
  private lastVideoTime = -1;
  private destroyed = false;

  private previousBodyOverflow = '';
  private previousRootOverflow = '';

  constructor() {
    this.sceneRenderer.setLivingMotion(this.livingMotion);
  }

  async startCamera(): Promise<void> {
    if (this.isLoading() || this.isActive() || this.destroyed) {
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }

      await this.tracking.initialize();

      if (this.destroyed) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (this.destroyed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stream = stream;

      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', this.onCameraTrackEnded);
      }

      const video = this.cameraRef.nativeElement;
      video.srcObject = stream;

      await video.play();

      if (this.destroyed) {
        this.stopCamera();
        return;
      }

      this.drawing.attach(this.drawingRef.nativeElement);

      this.resetPhysics();
      this.gesture.reset();
      this.interaction.reset();
      this.interaction.setTool('move');

      this.interactionMode.set('draw');
      this.displayMode.set('canvas');
      this.cameraPreviewVisible.set(true);
      this.waitingForRelease.set(false);
      this.hasTransformedObject.set(false);
      this.drawing.setSelectionVisible(false);

      this.lastVideoTime = -1;

      this.isRunning.set(true);
      this.detectHands();
    } catch (error) {
      this.stopCamera();

      if (!this.destroyed) {
        this.error.set(error instanceof Error ? error.message : 'Unable to start the camera.');
      }
    } finally {
      if (!this.destroyed) {
        this.isLoading.set(false);
      }
    }
  }

  startDemo(): void {
    if (this.isLoading() || this.isActive() || this.destroyed) {
      return;
    }

    this.error.set('');

    this.resetPhysics();
    this.drawing.clear();
    this.interaction.reset();
    this.interaction.setTool('move');
    this.gesture.reset();

    this.interactionMode.set('interact');
    this.waitingForRelease.set(false);
    this.hasTransformedObject.set(false);

    this.handCount.set(0);
    this.isPinching.set(false);

    this.isDemo.set(true);
  }

  stopDemo(): void {
    if (!this.isDemo()) {
      return;
    }

    this.demoStage?.cancelPointer();

    this.resetPhysics();
    this.interaction.reset();
    this.interaction.setTool('move');
    this.drawing.clear();
    this.gesture.reset();

    this.isDemo.set(false);
    this.interactionMode.set('draw');
    this.waitingForRelease.set(false);
    this.hasTransformedObject.set(false);
  }

  endSession(): void {
    if (this.isDemo()) {
      this.stopDemo();
      return;
    }

    this.stopCamera();
  }

  stopCamera(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    this.stream?.getVideoTracks().forEach((track) => {
      track.removeEventListener('ended', this.onCameraTrackEnded);
    });

    this.stream?.getTracks().forEach((track) => track.stop());

    this.stream = null;

    const video = this.cameraRef?.nativeElement;

    if (video) {
      video.pause();
      video.srcObject = null;
    }

    const overlay = this.overlayRef?.nativeElement;

    if (overlay) {
      overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    }

    this.resetPhysics();
    this.interaction.reset();
    this.interaction.setTool('move');

    this.drawing.setSelectionVisible(false);
    this.drawing.clear();
    this.gesture.reset();

    this.interactionMode.set('draw');
    this.waitingForRelease.set(false);
    this.hasTransformedObject.set(false);
    this.lastVideoTime = -1;

    this.isRunning.set(false);
    this.handCount.set(0);
    this.isPinching.set(false);
  }

  setMode(mode: InteractionMode): void {
    if (!this.isRunning() || this.interactionMode() === mode) {
      return;
    }

    if (this.interactionMode() === 'draw' && this.isPinching()) {
      const previousCount = this.scene.objects().length;

      this.drawing.finishStroke();

      if (this.scene.objects().length > previousCount) {
        this.wakePhysics();
      }
    }

    this.interaction.reset();
    this.gesture.reset();

    this.waitingForRelease.set(this.isPinching());
    this.interactionMode.set(mode);

    if (mode === 'interact') {
      this.interaction.setTool('move');
    }

    this.drawing.setSelectionVisible(mode === 'interact');
  }

  setInteractionTool(tool: InteractionTool): void {
    if (
      !this.isActive() ||
      this.interactionMode() !== 'interact' ||
      this.interactionTool() === tool
    ) {
      return;
    }

    if (this.isDemo()) {
      this.demoStage?.cancelPointer();
    }

    this.interaction.setTool(tool);

    if (this.isRunning()) {
      this.gesture.reset();
      this.waitingForRelease.set(this.isPinching());

      this.drawing.refreshScene();
    }

    this.wakePhysics();
  }

  clearDrawing(): void {
    if (!this.isActive()) {
      return;
    }

    if (this.isDemo()) {
      this.demoStage?.reset();
      this.hasTransformedObject.set(false);
      this.wakePhysics();
      return;
    }

    this.interaction.reset();
    this.drawing.clear();
    this.gesture.reset();

    this.sleepPhysics();

    this.waitingForRelease.set(this.isPinching());
    this.hasTransformedObject.set(false);
  }

  togglePhysics(): void {
    if (!this.isActive()) {
      return;
    }

    const enabled = !this.physicsEnabled();

    this.sleepPhysics();
    this.physicsEnabled.set(enabled);

    if (enabled) {
      this.wakePhysics();
    }

    this.refreshLivingScene();
  }

  wakePhysics(): void {
    if (!this.physicsEnabled() || !this.isActive()) {
      return;
    }

    this.physicsEngine.reset();
    this.lastPhysicsTimestamp = null;

    this.physicsAwake.set(this.scene.objects().length > 0);
  }

  advancePhysics(timestamp: number): void {
    if (
      !this.physicsEnabled() ||
      !this.physicsAwake() ||
      !this.isActive() ||
      !Number.isFinite(timestamp) ||
      this.isPinching() ||
      this.isDragging() ||
      this.waitingForRelease()
    ) {
      this.lastPhysicsTimestamp = null;
      return;
    }

    const viewport = this.getPhysicsViewport();

    if (!viewport) {
      this.lastPhysicsTimestamp = null;
      return;
    }

    const deltaSeconds =
      this.lastPhysicsTimestamp === null
        ? 1 / 60
        : Math.max(0, Math.min(0.05, (timestamp - this.lastPhysicsTimestamp) / 1000));

    this.lastPhysicsTimestamp = timestamp;

    const result = this.physicsEngine.step(this.scene.objects(), viewport, deltaSeconds);

    if (this.scene.applyPhysicsPositions(result.positions)) {
      this.refreshLivingScene();
    }

    this.physicsAwake.set(result.awake);
  }

  refreshLivingScene(): void {
    if (this.isDemo()) {
      this.demoStage?.refresh();
      return;
    }

    if (this.isRunning()) {
      this.drawing.refreshScene();
    }
  }

  async toggleFullscreen(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const stage = this.stageRef?.nativeElement;

    if (!stage) {
      return;
    }

    if (this.isFullscreenFallback()) {
      this.exitFullscreenFallback();
      return;
    }

    if (document.fullscreenElement === stage) {
      try {
        await document.exitFullscreen();
      } catch {
        this.error.set('Unable to exit fullscreen mode.');
      }

      return;
    }

    try {
      if (typeof stage.requestFullscreen !== 'function') {
        this.enterFullscreenFallback();
        return;
      }

      await stage.requestFullscreen();

      if (!this.destroyed) {
        this.isFullscreen.set(true);
      }
    } catch {
      if (!this.destroyed) {
        this.enterFullscreenFallback();
      }
    }
  }

  private readonly onCameraTrackEnded = (): void => {
    if (!this.isRunning() || this.destroyed) {
      return;
    }

    this.stopCamera();

    this.error.set('Camera connection was lost. Please reconnect your camera.');
  };

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    if (this.destroyed) {
      return;
    }

    const stage = this.stageRef?.nativeElement;

    const fullscreen = document.fullscreenElement === stage || this.isFullscreenFallback();

    this.isFullscreen.set(fullscreen);

    this.wakePhysics();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isFullscreenFallback()) {
      this.exitFullscreenFallback();
    }
  }

  @HostListener('window:resize')
  onViewportResize(): void {
    if (this.destroyed || !this.isActive()) {
      return;
    }

    this.wakePhysics();
  }

  ngOnDestroy(): void {
    const stage = this.stageRef?.nativeElement;

    this.destroyed = true;

    if (this.isFullscreenFallback()) {
      this.exitFullscreenFallback();
    }

    if (stage && document.fullscreenElement === stage) {
      void document.exitFullscreen().catch(() => {});
    }

    this.stopDemo();
    this.stopCamera();
    this.tracking.dispose();
  }

  private getPhysicsViewport(): PhysicsViewport | null {
    if (this.isDemo()) {
      return this.demoStage?.getViewport() ?? null;
    }

    if (!this.isRunning()) {
      return null;
    }

    const canvas = this.drawingRef?.nativeElement;

    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      return null;
    }

    const viewport: PhysicsViewport = {
      width: canvas.width,
      height: canvas.height,
    };

    if (!this.isFullscreen()) {
      return viewport;
    }

    const surface = this.cameraSurfaceRef?.nativeElement;
    const footer = this.stageFooterRef?.nativeElement;

    if (!surface || !footer) {
      return viewport;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();

    if (canvasRect.width <= 0 || canvasRect.height <= 0) {
      return viewport;
    }

    const scale = Math.max(canvasRect.width / canvas.width, canvasRect.height / canvas.height);

    if (!Number.isFinite(scale) || scale <= 0) {
      return viewport;
    }

    const renderedHeight = canvas.height * scale;

    const verticalOffset = (canvasRect.height - renderedHeight) / 2;

    let visibleBottom = Math.min(canvasRect.bottom, surfaceRect.bottom);

    const footerOverlaps =
      footerRect.top < visibleBottom &&
      footerRect.bottom > surfaceRect.top &&
      footerRect.left < surfaceRect.right &&
      footerRect.right > surfaceRect.left;

    if (footerOverlaps) {
      visibleBottom = Math.min(visibleBottom, footerRect.top);
    }

    const safetyMargin = 16;

    const floorY = (visibleBottom - canvasRect.top - verticalOffset - safetyMargin) / scale;

    if (!Number.isFinite(floorY)) {
      return viewport;
    }

    return {
      width: canvas.width,
      height: Math.max(1, Math.min(canvas.height, Math.floor(floorY))),
    };
  }

  private sleepPhysics(): void {
    this.physicsEngine.reset();
    this.lastPhysicsTimestamp = null;
    this.physicsAwake.set(false);
  }

  private resetPhysics(): void {
    this.sleepPhysics();
    this.physicsEnabled.set(false);
  }

  private enterFullscreenFallback(): void {
    if (this.isFullscreenFallback()) {
      return;
    }

    this.previousBodyOverflow = document.body.style.overflow;

    this.previousRootOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    this.isFullscreenFallback.set(true);
    this.isFullscreen.set(true);
    this.wakePhysics();
  }

  private exitFullscreenFallback(): void {
    if (!this.isFullscreenFallback()) {
      return;
    }

    document.body.style.overflow = this.previousBodyOverflow;

    document.documentElement.style.overflow = this.previousRootOverflow;

    this.isFullscreenFallback.set(false);
    this.isFullscreen.set(false);
    this.wakePhysics();
  }

  private detectHands = (): void => {
    if (!this.isRunning() || this.destroyed) {
      return;
    }

    try {
      const video = this.cameraRef.nativeElement;
      const overlay = this.overlayRef.nativeElement;

      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
          overlay.width = video.videoWidth;
          overlay.height = video.videoHeight;
        }

        this.drawing.resize(video.videoWidth, video.videoHeight);

        if (video.currentTime !== this.lastVideoTime) {
          this.lastVideoTime = video.currentTime;

          const now = performance.now();

          const hands = this.tracking.detect(video, now);

          const hand = hands[0];

          const gesture = this.gesture.update(hand, now);

          this.handCount.set(hands.length);
          this.isPinching.set(gesture.active);

          if (this.waitingForRelease()) {
            if (!gesture.active) {
              this.waitingForRelease.set(false);
              this.gesture.reset();
              this.wakePhysics();
            }
          } else if (this.interactionMode() === 'draw') {
            if (gesture.action === 'start') {
              this.drawing.beginStroke();
            }

            if ((gesture.action === 'start' || gesture.action === 'draw') && gesture.cursor) {
              this.drawing.draw(gesture.cursor.x, gesture.cursor.y);
            }

            if (gesture.action === 'end') {
              const previousCount = this.scene.objects().length;

              this.drawing.finishStroke();

              if (this.scene.objects().length > previousCount) {
                this.wakePhysics();
              }
            }
          } else {
            const wasDragging = this.isDragging();

            const changed = this.interaction.handle(gesture, video.videoWidth, video.videoHeight);

            if (changed && gesture.action === 'draw' && this.isDragging()) {
              this.hasTransformedObject.set(true);
            }

            if (changed) {
              this.drawing.refreshScene();
            }

            if (wasDragging && !this.isDragging()) {
              this.wakePhysics();
            }
          }

          this.tracking.render(overlay, hand, gesture.cursor, gesture.active);
        }
      }
    } catch (error) {
      this.stopCamera();

      if (!this.destroyed) {
        this.error.set(
          error instanceof Error ? error.message : 'Hand tracking stopped unexpectedly.',
        );
      }

      return;
    }

    this.frameId = requestAnimationFrame(this.detectHands);
  };

  setDisplayMode(mode: DisplayMode): void {
    if (
      !this.isRunning() ||
      this.displayMode() === mode ||
      this.isPinching() ||
      this.isDragging() ||
      this.waitingForRelease()
    ) {
      return;
    }

    this.displayMode.set(mode);
  }

  toggleCameraPreview(): void {
    if (!this.isRunning()) {
      return;
    }

    this.cameraPreviewVisible.update((visible) => !visible);
  }
}
