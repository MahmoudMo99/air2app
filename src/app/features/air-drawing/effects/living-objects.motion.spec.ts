import { describe, expect, it, vi } from 'vitest';
import { SceneObject } from '../scene/scene.models';
import { SceneRenderer } from '../scene/scene.renderer';
import { LivingObjectsMotion } from './living-objects.motion';

describe('LivingObjectsMotion', () => {
  const circle: SceneObject = {
    id: 'scene-1',
    kind: 'circle',
    center: { x: 200, y: 200 },
    width: 120,
    height: 120,
    rotation: 0,
  };

  const square: SceneObject = {
    ...circle,
    id: 'scene-2',
    kind: 'square',
  };

  it('does not move objects by default', () => {
    const motion = new LivingObjectsMotion();

    motion.advance(2000, 720);

    expect(motion.offsetFor(circle)).toBe(0);
  });

  it('starts the floating motion gradually', () => {
    const motion = new LivingObjectsMotion();

    motion.setActive(true, 100);
    motion.advance(100, 720);

    expect(motion.offsetFor(circle)).toBeCloseTo(0, 10);

    motion.advance(180, 720);

    expect(Math.abs(motion.offsetFor(circle))).toBeLessThanOrEqual(5.5);
  });

  it('keeps the floating offset within its limit', () => {
    const motion = new LivingObjectsMotion();

    motion.setActive(true, 0);

    for (let time = 500; time <= 10000; time += 100) {
      motion.advance(time, 1080);

      expect(Math.abs(motion.offsetFor(circle))).toBeLessThanOrEqual(5.5);
    }
  });

  it('creates different motion phases for different objects', () => {
    const motion = new LivingObjectsMotion();

    motion.setActive(true, 0);
    motion.advance(2200, 720);

    expect(motion.offsetFor(circle)).not.toBeCloseTo(motion.offsetFor(square), 4);
  });

  it('changes the visual offset over time', () => {
    const motion = new LivingObjectsMotion();

    motion.setActive(true, 0);
    motion.advance(1200, 720);

    const first = motion.offsetFor(circle);

    motion.advance(2200, 720);

    expect(motion.offsetFor(circle)).not.toBeCloseTo(first, 4);
  });

  it('stops the motion when disabled', () => {
    const motion = new LivingObjectsMotion();

    motion.setActive(true, 0);
    motion.advance(1800, 720);

    expect(motion.isActive).toBe(true);

    motion.setActive(false, 1900);

    expect(motion.isActive).toBe(false);
    expect(motion.offsetFor(circle)).toBe(0);
  });

  it('applies the same visual offset to the shape and selection', () => {
    const motion = new LivingObjectsMotion();

    motion.setActive(true, 0);
    motion.advance(1800, 720);

    const renderer = new SceneRenderer();
    renderer.setLivingMotion(motion);

    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      roundRect: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    renderer.render(context, circle, '#52f5d0', 4);
    renderer.renderSelection(context, circle);

    const expectedY = circle.center.y + motion.offsetFor(circle);

    expect(context.translate).toHaveBeenNthCalledWith(1, circle.center.x, expectedY);

    expect(context.translate).toHaveBeenNthCalledWith(2, circle.center.x, expectedY);

    expect(circle.center).toEqual({
      x: 200,
      y: 200,
    });
  });
});
