import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneObject } from '../scene/scene.models';
import { SceneCreationEffectsRenderer } from './scene-creation-effects.renderer';

describe('SceneCreationEffectsRenderer', () => {
  let renderer: SceneCreationEffectsRenderer;
  let context: CanvasRenderingContext2D;

  const circle: SceneObject = {
    id: 'scene-1',
    kind: 'circle',
    center: { x: 250, y: 200 },
    width: 120,
    height: 120,
    rotation: 0,
  };

  const rectangle: SceneObject = {
    id: 'scene-2',
    kind: 'rectangle',
    center: { x: 300, y: 240 },
    width: 180,
    height: 100,
    rotation: Math.PI / 6,
  };

  beforeEach(() => {
    renderer = new SceneCreationEffectsRenderer();

    context = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      setLineDash: vi.fn(),
      arc: vi.fn(),
      roundRect: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  });

  it('renders a creation burst around a circle', () => {
    renderer.draw(context, circle, 0.25);

    expect(context.translate).toHaveBeenCalledWith(250, 200);

    expect(context.arc).toHaveBeenCalled();
    expect(context.fill).toHaveBeenCalledTimes(14);
    expect(context.stroke).toHaveBeenCalled();
    expect(context.restore).toHaveBeenCalled();
  });

  it('renders the effect around a rotated rectangle', () => {
    renderer.draw(context, rectangle, 0.3);

    expect(context.translate).toHaveBeenCalledWith(300, 240);

    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 6);

    expect(context.roundRect).toHaveBeenCalled();
    expect(context.setLineDash).toHaveBeenCalled();
    expect(context.restore).toHaveBeenCalled();
  });

  it('restores the canvas state if drawing fails', () => {
    vi.mocked(context.stroke).mockImplementation(() => {
      throw new Error('Canvas render failed');
    });

    expect(() => renderer.draw(context, circle, 0.4)).toThrow('Canvas render failed');

    expect(context.restore).toHaveBeenCalled();
  });
});
