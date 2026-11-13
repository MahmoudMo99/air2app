import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrawingEngineService } from './drawing-engine.service';
import { SceneRenderer } from './scene/scene.renderer';
import { SceneStore } from './scene/scene.store';
import { ShapeRecognitionService } from './shape-recognition.service';

describe('DrawingEngineService', () => {
  let service: DrawingEngineService;
  let recognizer: ShapeRecognitionService;
  let scene: SceneStore;
  let context: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DrawingEngineService, ShapeRecognitionService, SceneStore, SceneRenderer],
    });

    service = TestBed.inject(DrawingEngineService);
    recognizer = TestBed.inject(ShapeRecognitionService);
    scene = TestBed.inject(SceneStore);

    context = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      roundRect: vi.fn(),
      arc: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    canvas = {
      width: 1000,
      height: 800,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    service.attach(canvas);
  });

  function drawHorizontalLine(): void {
    service.beginStroke();

    for (let i = 0; i <= 30; i++) {
      service.draw(0.1 + i * 0.02, 0.4);
    }

    service.finishStroke();
  }

  it('starts with an empty canvas state', () => {
    expect(service.strokeCount()).toBe(0);
    expect(service.lastShape()).toBe('No strokes yet');
    expect(scene.objects()).toHaveLength(0);
  });

  it('recognizes a completed straight line', () => {
    drawHorizontalLine();

    expect(service.strokeCount()).toBe(1);
    expect(service.lastShape()).toBe('Line');
  });

  it('keeps short strokes stored in the trailing buffer', () => {
    service.beginStroke();

    service.draw(0.1, 0.25);
    service.draw(0.12, 0.25);
    service.draw(0.14, 0.25);

    service.finishStroke();

    expect(service.strokeCount()).toBe(1);
    expect(service.lastShape()).toBe('Freehand');
  });

  it('ignores a stroke with only one point', () => {
    service.beginStroke();
    service.draw(0.2, 0.3);
    service.finishStroke();

    expect(service.strokeCount()).toBe(0);
    expect(service.lastShape()).toBe('No strokes yet');
  });

  it('clears completed strokes and resets signals', () => {
    drawHorizontalLine();

    expect(service.strokeCount()).toBe(1);

    service.clear();

    expect(service.strokeCount()).toBe(0);
    expect(service.lastShape()).toBe('No strokes yet');
    expect(context.clearRect).toHaveBeenCalled();
  });

  it('clears strokes when canvas dimensions change', () => {
    drawHorizontalLine();

    service.resize(1200, 800);

    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(800);
    expect(service.strokeCount()).toBe(0);
    expect(service.lastShape()).toBe('No strokes yet');
  });

  it('preserves strokes when canvas dimensions do not change', () => {
    drawHorizontalLine();

    service.resize(1000, 800);

    expect(service.strokeCount()).toBe(1);
    expect(service.lastShape()).toBe('Line');
  });

  it('splits a stroke after an abrupt tracking jump', () => {
    service.beginStroke();

    for (let i = 0; i <= 20; i++) {
      service.draw(0.1 + i * 0.015, 0.4);
    }

    for (let i = 0; i <= 12; i++) {
      service.draw(0.85 + i * 0.01, 0.4);
    }

    service.finishStroke();

    expect(service.strokeCount()).toBe(2);
    expect(service.lastShape()).toBe('Line');
  });

  it('converts a recognized circle into a scene object', () => {
    vi.spyOn(recognizer, 'recognize').mockReturnValue({
      kind: 'circle',
      bounds: {
        x: 200,
        y: 150,
        width: 160,
        height: 160,
      },
    });

    drawHorizontalLine();

    expect(scene.objects()).toHaveLength(1);

    expect(scene.objects()[0]).toMatchObject({
      kind: 'circle',
      center: {
        x: 280,
        y: 230,
      },
      width: 160,
      height: 160,
      rotation: 0,
    });

    expect(service.strokeCount()).toBe(1);
    expect(service.lastShape()).toBe('Circle');
    expect(context.arc).toHaveBeenCalled();
  });

  it('clears scene objects along with completed strokes', () => {
    vi.spyOn(recognizer, 'recognize').mockReturnValue({
      kind: 'circle',
      bounds: {
        x: 200,
        y: 150,
        width: 160,
        height: 160,
      },
    });

    drawHorizontalLine();

    expect(scene.objects()).toHaveLength(1);

    service.clear();

    expect(scene.objects()).toHaveLength(0);
    expect(scene.selectedId()).toBeNull();
    expect(service.strokeCount()).toBe(0);
    expect(service.lastShape()).toBe('No strokes yet');
  });

  it('restores the active stroke after a scene refresh', () => {
    service.beginStroke();

    for (let i = 0; i < 10; i++) {
      service.draw(0.1 + i * 0.015, 0.4);
    }

    const previousStrokes = vi.mocked(context.stroke).mock.calls.length;

    expect(previousStrokes).toBeGreaterThan(0);

    service.refreshScene();

    expect(context.stroke).toHaveBeenCalledTimes(previousStrokes + 1);

    expect(service.strokeCount()).toBe(0);
  });

  it('does not duplicate an active stroke when it finishes', () => {
    service.beginStroke();

    for (let i = 0; i < 10; i++) {
      service.draw(0.1 + i * 0.015, 0.4);
    }

    service.refreshScene();
    service.refreshScene();

    expect(service.strokeCount()).toBe(0);

    service.finishStroke();

    expect(service.strokeCount()).toBe(1);
  });

  it('ignores invalid drawing coordinates', () => {
    const recognize = vi.spyOn(recognizer, 'recognize');

    service.beginStroke();

    service.draw(Number.NaN, 0.4);
    service.draw(0.3, Number.POSITIVE_INFINITY);
    service.draw(Number.NEGATIVE_INFINITY, 0.5);

    service.finishStroke();

    expect(service.strokeCount()).toBe(0);
    expect(recognize).not.toHaveBeenCalled();
  });

  it('ignores invalid canvas dimensions', () => {
    drawHorizontalLine();

    service.resize(-100, 800);
    service.resize(Number.NaN, 800);
    service.resize(1000, 0);

    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(800);
    expect(service.strokeCount()).toBe(1);
  });

  it('reuses the canvas context across rendering operations', () => {
    drawHorizontalLine();

    service.refreshScene();
    service.refreshScene();
    service.clear();

    expect(canvas.getContext).toHaveBeenCalledTimes(1);
  });
});
