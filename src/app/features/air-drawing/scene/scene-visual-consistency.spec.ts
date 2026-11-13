import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GestureFrame } from '../drawing.models';
import { LivingObjectsMotion } from '../effects/living-objects.motion';
import { ObjectInteractionController } from './object-interaction.controller';
import { NewSceneObject } from './scene.models';
import { SceneStore } from './scene.store';

describe('Scene visual interaction consistency', () => {
  let store: SceneStore;
  let motion: LivingObjectsMotion;
  let controller: ObjectInteractionController;

  const circle: NewSceneObject = {
    kind: 'circle',
    center: { x: 300, y: 300 },
    width: 100,
    height: 100,
    rotation: 0,
  };

  function gesture(action: 'start' | 'draw', x: number, y: number): GestureFrame {
    return {
      action,
      active: true,
      cursor: {
        x: x / 600,
        y: y / 600,
      },
    } as GestureFrame;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SceneStore, LivingObjectsMotion, ObjectInteractionController],
    });

    store = TestBed.inject(SceneStore);
    motion = TestBed.inject(LivingObjectsMotion);
    controller = TestBed.inject(ObjectInteractionController);
  });

  it('selects a circle at its visual position', () => {
    const object = store.addObject(circle);

    const point = {
      x: 300,
      y: 360,
    };

    expect(store.selectAt(point)).toBeNull();

    const selected = store.selectAt(point, () => 5.5);

    expect(selected?.id).toBe(object.id);
  });

  it('supports a negative visual offset', () => {
    const object = store.addObject(circle);

    const point = {
      x: 300,
      y: 240,
    };

    expect(store.selectAt(point)).toBeNull();

    const selected = store.selectAt(point, () => -5.5);

    expect(selected?.id).toBe(object.id);
  });

  it('selects rotated shapes with their visual offset', () => {
    const object = store.addObject({
      kind: 'rectangle',
      center: { x: 200, y: 200 },
      width: 120,
      height: 60,
      rotation: Math.PI / 4,
    });

    const point = {
      x: 200 + 65 * Math.SQRT1_2,
      y: 200 + 65 * Math.SQRT1_2 + 5,
    };

    const selected = store.selectAt(point, () => 5);

    expect(selected?.id).toBe(object.id);
  });

  it('uses the active floating offset when starting a drag', () => {
    const object = store.addObject(circle);

    motion.setActive(true, 0);

    let offset = 0;

    for (let time = 700; time <= 10000; time += 100) {
      motion.advance(time, 720);
      offset = motion.offsetFor(object);

      if (Math.abs(offset) > 3) {
        break;
      }
    }

    expect(Math.abs(offset)).toBeGreaterThan(3);

    const pointY = circle.center.y + offset + Math.sign(offset) * 57;

    store.clearSelection();

    expect(
      store.selectAt({
        x: circle.center.x,
        y: pointY,
      }),
    ).toBeNull();

    const changed = controller.handle(gesture('start', circle.center.x, pointY), 600, 600);

    expect(changed).toBe(true);
    expect(controller.isDragging()).toBe(true);
    expect(store.selectedId()).toBe(object.id);
  });

  it('accumulates consecutive small pointer movements', () => {
    store.addObject(circle);

    controller.handle(gesture('start', 300, 300), 600, 600);

    const first = controller.handle(gesture('draw', 300.3, 300), 600, 600);

    expect(first).toBe(false);

    const second = controller.handle(gesture('draw', 300.6, 300), 600, 600);

    expect(second).toBe(true);

    expect(store.selectedObject()?.center.x).toBeCloseTo(300.6, 5);
  });

  it('does not update the scene for zero movement', () => {
    const object = store.addObject(circle);

    expect(store.moveSelectedBy(0, 0)).toBe(false);

    expect(store.objects()[0]).toBe(object);
    expect(store.selectedObject()?.center).toEqual({
      x: 300,
      y: 300,
    });
  });

  it('rejects viewport scaling that overflows', () => {
    const object = store.addObject(circle);

    const changed = store.resizeViewport(1e-300, 1e-300, 1e300, 1e300);

    expect(changed).toBe(false);
    expect(store.objects()[0]).toBe(object);
  });

  it('does not mutate scene geometry during visual selection', () => {
    const original = store.addObject(circle);

    const selected = store.selectAt({ x: 300, y: 360 }, () => 5.5);

    expect(selected?.id).toBe(original.id);

    expect(store.selectedObject()?.center).toEqual({
      x: 300,
      y: 300,
    });

    expect(original.center).toEqual({
      x: 300,
      y: 300,
    });
  });
});
