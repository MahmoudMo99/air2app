import { beforeEach, describe, expect, it } from 'vitest';
import { NewSceneObject } from './scene.models';
import { SceneStore } from './scene.store';

describe('SceneStore', () => {
  let store: SceneStore;

  const rectangle: NewSceneObject = {
    kind: 'rectangle',
    center: { x: 200, y: 200 },
    width: 120,
    height: 60,
    rotation: 0,
  };

  beforeEach(() => {
    store = new SceneStore();
  });

  it('starts with an empty scene', () => {
    expect(store.objects()).toEqual([]);
    expect(store.selectedId()).toBeNull();
    expect(store.selectedObject()).toBeNull();
  });

  it('adds and selects a new object', () => {
    const object = store.addObject(rectangle);

    expect(store.objects()).toHaveLength(1);
    expect(object.kind).toBe('rectangle');
    expect(store.selectedId()).toBe(object.id);
    expect(store.selectedObject()?.id).toBe(object.id);
  });

  it('assigns unique IDs to objects', () => {
    const first = store.addObject(rectangle);
    const second = store.addObject(rectangle);

    expect(first.id).not.toBe(second.id);
    expect(store.objects()).toHaveLength(2);
  });

  it('selects a circle using hit testing', () => {
    const circle = store.addObject({
      kind: 'circle',
      center: { x: 300, y: 300 },
      width: 100,
      height: 100,
      rotation: 0,
    });

    store.clearSelection();

    const selected = store.selectAt({
      x: 325,
      y: 310,
    });

    expect(selected?.id).toBe(circle.id);
  });

  it('selects a rotated rectangle correctly', () => {
    const object = store.addObject({
      ...rectangle,
      rotation: Math.PI / 4,
    });

    store.clearSelection();

    const selected = store.selectAt({
      x: 200 + 35 * Math.SQRT1_2,
      y: 200 + 35 * Math.SQRT1_2,
    });

    expect(selected?.id).toBe(object.id);
  });

  it('selects the topmost object when objects overlap', () => {
    store.addObject(rectangle);
    const topmost = store.addObject(rectangle);

    const selected = store.selectAt({
      x: 200,
      y: 200,
    });

    expect(selected?.id).toBe(topmost.id);
  });

  it('clears selection when clicking empty space', () => {
    store.addObject(rectangle);

    const selected = store.selectAt({
      x: 900,
      y: 700,
    });

    expect(selected).toBeNull();
    expect(store.selectedObject()).toBeNull();
  });

  it('moves a selected object without mutating the original', () => {
    const original = store.addObject(rectangle);

    const moved = store.moveSelectedBy(50, -20);

    expect(moved).toBe(true);
    expect(store.selectedObject()?.center).toEqual({
      x: 250,
      y: 180,
    });

    expect(original.center).toEqual({
      x: 200,
      y: 200,
    });
  });

  it('removes the selected object', () => {
    store.addObject(rectangle);

    expect(store.removeSelected()).toBe(true);
    expect(store.objects()).toHaveLength(0);
    expect(store.selectedId()).toBeNull();
  });

  it('rejects objects with invalid dimensions', () => {
    expect(() =>
      store.addObject({
        ...rectangle,
        width: 0,
      }),
    ).toThrow('Invalid scene object dimensions');
  });

  it('clears all objects and their selection', () => {
    store.addObject(rectangle);
    store.addObject(rectangle);

    store.clear();

    expect(store.objects()).toEqual([]);
    expect(store.selectedObject()).toBeNull();
  });

  it('updates selected dimensions and rotation immutably', () => {
    const original = store.addObject(rectangle);

    const changed = store.setSelectedTransform({
      width: 180,
      height: 90,
      rotation: Math.PI / 3,
    });

    expect(changed).toBe(true);

    expect(store.selectedObject()).toMatchObject({
      width: 180,
      height: 90,
      rotation: Math.PI / 3,
    });

    expect(original.width).toBe(120);
    expect(original.height).toBe(60);
    expect(original.rotation).toBe(0);
  });

  it('rejects invalid object transformations', () => {
    store.addObject(rectangle);

    expect(
      store.setSelectedTransform({
        width: 0,
        height: 100,
        rotation: 0,
      }),
    ).toBe(false);

    expect(
      store.setSelectedTransform({
        width: 120,
        height: 60,
        rotation: Number.NaN,
      }),
    ).toBe(false);

    expect(store.selectedObject()?.width).toBe(120);
  });

  it('rescales scene objects when viewport dimensions change', () => {
    const original = store.addObject(rectangle);

    const changed = store.resizeViewport(1000, 800, 500, 400);

    expect(changed).toBe(true);

    expect(store.selectedObject()?.center).toEqual({
      x: 100,
      y: 100,
    });

    expect(store.selectedObject()?.width).toBe(60);
    expect(store.selectedObject()?.height).toBe(30);

    expect(original.center).toEqual({
      x: 200,
      y: 200,
    });
  });

  it('preserves shape dimensions after reversing viewport resize', () => {
    store.addObject(rectangle);

    store.resizeViewport(1000, 800, 600, 500);
    store.resizeViewport(600, 500, 1000, 800);

    const object = store.selectedObject();

    expect(object?.center.x).toBeCloseTo(200);
    expect(object?.center.y).toBeCloseTo(200);
    expect(object?.width).toBeCloseTo(120);
    expect(object?.height).toBeCloseTo(60);
    expect(object?.rotation).toBe(0);
  });

  it('applies physics positions without mutating original objects', () => {
    const original = store.addObject(rectangle);

    const changed = store.applyPhysicsPositions(new Map([[original.id, { x: 260, y: 310 }]]));

    expect(changed).toBe(true);

    expect(store.selectedObject()?.center).toEqual({
      x: 260,
      y: 310,
    });

    expect(original.center).toEqual({
      x: 200,
      y: 200,
    });
  });
});
