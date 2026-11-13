import { Injectable } from '@angular/core';
import {
  DrawingUtils,
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { DrawPoint } from './drawing.models';

@Injectable()
export class HandTrackingService {
  private model: HandLandmarker | null = null;
  private initialization: Promise<void> | null = null;
  private disposed = false;

  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayContext: CanvasRenderingContext2D | null = null;
  private drawingUtils: DrawingUtils | null = null;

  initialize(): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error('Hand tracking service has been disposed.'));
    }

    if (this.model) {
      return Promise.resolve();
    }

    if (this.initialization) {
      return this.initialization;
    }

    this.initialization = this.createModel().finally(() => {
      this.initialization = null;
    });

    return this.initialization;
  }

  detect(video: HTMLVideoElement, now: number): NormalizedLandmark[][] {
    if (this.disposed || !this.model || !Number.isFinite(now)) {
      return [];
    }

    return this.model.detectForVideo(video, now).landmarks ?? [];
  }

  render(
    canvas: HTMLCanvasElement,
    hand: NormalizedLandmark[] | undefined,
    cursor: DrawPoint | null,
    pinching: boolean,
  ): void {
    if (this.disposed) {
      return;
    }

    if (this.overlayCanvas !== canvas || !this.overlayContext || !this.drawingUtils) {
      const context = canvas.getContext('2d');

      if (!context) {
        return;
      }

      this.overlayCanvas = canvas;
      this.overlayContext = context;
      this.drawingUtils = new DrawingUtils(context);
    }

    const ctx = this.overlayContext;
    const drawing = this.drawingUtils;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!hand || hand.length === 0) {
      return;
    }

    ctx.save();

    try {
      drawing.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, {
        color: '#a990ff',
        lineWidth: 3,
      });

      drawing.drawLandmarks(hand, {
        color: '#f5f0ff',
        radius: 3,
      });

      if (!cursor || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) {
        return;
      }

      const x = Math.max(0, Math.min(1, cursor.x)) * canvas.width;

      const y = Math.max(0, Math.min(1, cursor.y)) * canvas.height;

      const color = pinching ? '#52f5d0' : '#b6a4ff';

      ctx.beginPath();
      ctx.arc(x, y, pinching ? 14 : 10, 0, Math.PI * 2);

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = pinching ? 25 : 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (pinching) {
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, Math.PI * 2);

        ctx.strokeStyle = 'rgba(82,245,208,0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } finally {
      ctx.restore();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    this.model?.close();
    this.model = null;

    this.overlayCanvas = null;
    this.overlayContext = null;
    this.drawingUtils = null;
  }

  private async createModel(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm',
    );

    if (this.disposed) {
      return;
    }

    const modelAssetPath =
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

    let model: HandLandmarker;

    try {
      model = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    } catch {
      if (this.disposed) {
        return;
      }

      model = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    }

    if (this.disposed) {
      model.close();
      return;
    }

    this.model = model;
  }
}
