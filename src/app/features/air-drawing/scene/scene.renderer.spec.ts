import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneObject } from './scene.models';
import { SceneRenderer } from './scene.renderer';

describe('SceneRenderer', () => {
  let renderer: SceneRenderer;
  let context: CanvasRenderingContext2D;

  const rectangle: SceneObject = {
    id: 'scene-1',
    kind: 'rectangle',
    center: { x: 300, y: 220 },
    width: 180,
    height: 100,
    rotation: Math.PI / 4,
  };

  beforeEach(() => {
    renderer = new SceneRenderer();

    context = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });

  it('renders a rectangle with its position and rotation', () => {
    renderer.render(context, rectangle, '#52f5d0', 5);

    expect(context.translate).toHaveBeenCalledWith(300, 220);

    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 4);

    expect(context.roundRect).toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalled();
    expect(context.restore).toHaveBeenCalled();
  });

  it('renders a circle using its radius', () => {
    const circle: SceneObject = {
      id: 'scene-2',
      kind: 'circle',
      center: { x: 400, y: 250 },
      width: 120,
      height: 120,
      rotation: 0,
    };

    renderer.render(context, circle, '#52f5d0', 5);

    expect(context.arc).toHaveBeenCalledWith(0, 0, 60, 0, Math.PI * 2);
  });

  it('renders a selection outline around a rotated object', () => {
    renderer.renderSelection(context, rectangle);

    expect(context.translate).toHaveBeenCalledWith(300, 220);

    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 4);

    expect(context.roundRect).toHaveBeenCalledWith(-101, -61, 202, 122, 9);

    expect(context.stroke).toHaveBeenCalled();
    expect(context.restore).toHaveBeenCalled();
  });

  it('renders four selection handles around an object', () => {
    renderer.renderSelection(context, rectangle);

    expect(context.arc).toHaveBeenCalledTimes(4);
    expect(context.restore).toHaveBeenCalled();
  });

  it('restores the canvas state when rendering fails', () => {
    vi.mocked(context.beginPath).mockImplementation(() => {
      throw new Error('Canvas error');
    });

    expect(() => renderer.render(context, rectangle, '#52f5d0', 5)).toThrow('Canvas error');

    expect(context.restore).toHaveBeenCalled();
  });
});
