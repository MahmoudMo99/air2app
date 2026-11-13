import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GestureFrame } from '../drawing.models';
import { ObjectInteractionController } from './object-interaction.controller';
import { SceneStore } from './scene.store';

describe('ObjectInteractionController', () => {
  let controller: ObjectInteractionController;
  let scene: SceneStore;

  const width = 1000;
  const height = 800;

  const start = (x = 0.2, y = 0.25): GestureFrame => ({
    active: true,
    action: 'start',
    cursor: { x, y },
  });

  const move = (x: number, y: number): GestureFrame => ({
    active: true,
    action: 'draw',
    cursor: { x, y },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SceneStore, ObjectInteractionController],
    });

    controller = TestBed.inject(ObjectInteractionController);
    scene = TestBed.inject(SceneStore);

    scene.addObject({
      kind: 'rectangle',
      center: { x: 200, y: 200 },
      width: 120,
      height: 80,
      rotation: 0,
    });
  });

  it('selects an object when pinch starts inside it', () => {
    const changed = controller.handle(start(), width, height);

    expect(changed).toBe(true);
    expect(controller.isDragging()).toBe(true);
    expect(scene.selectedObject()?.kind).toBe('rectangle');
  });

  it('moves the selected object with the cursor', () => {
    controller.handle(start(), width, height);
    controller.handle(move(0.225, 0.275), width, height);

    expect(scene.selectedObject()?.center.x).toBeCloseTo(225);
    expect(scene.selectedObject()?.center.y).toBeCloseTo(220);
  });

  it('does not start dragging in empty space', () => {
    controller.handle(start(0.8, 0.8), width, height);

    expect(controller.isDragging()).toBe(false);
    expect(scene.selectedObject()).toBeNull();
  });

  it('does not move an object without starting a pinch', () => {
    controller.handle(move(0.3, 0.3), width, height);

    expect(scene.objects()[0].center).toEqual({
      x: 200,
      y: 200,
    });
  });

  it('stops dragging when the pinch ends', () => {
    controller.handle(start(), width, height);

    controller.handle(
      {
        active: false,
        action: 'end',
        cursor: null,
      },
      width,
      height,
    );

    expect(controller.isDragging()).toBe(false);

    controller.handle(move(0.3, 0.3), width, height);

    expect(scene.objects()[0].center).toEqual({
      x: 200,
      y: 200,
    });
  });

  it('stops dragging when tracking is paused', () => {
    controller.handle(start(), width, height);

    controller.handle(
      {
        active: false,
        action: 'pause',
        cursor: null,
      },
      width,
      height,
    );

    expect(controller.isDragging()).toBe(false);
  });

  it('rejects sudden tracking jumps', () => {
    controller.handle(start(), width, height);
    controller.handle(move(0.9, 0.9), width, height);

    expect(controller.isDragging()).toBe(false);

    expect(scene.objects()[0].center).toEqual({
      x: 200,
      y: 200,
    });
  });

  it('rejects invalid canvas dimensions', () => {
    controller.handle(start(), 0, height);

    expect(controller.isDragging()).toBe(false);
  });

  it('resets interaction and selection', () => {
    controller.handle(start(), width, height);

    controller.reset();

    expect(controller.isDragging()).toBe(false);
    expect(scene.selectedId()).toBeNull();
  });

  it('scales an object using vertical hand movement', () => {
    controller.setTool('scale');

    controller.handle(start(), width, height);
    controller.handle(move(0.2, 0.2), width, height);

    const object = scene.selectedObject();

    expect(object?.width).toBeGreaterThan(120);
    expect(object?.height).toBeGreaterThan(80);
    expect(object?.center).toEqual({ x: 200, y: 200 });
    expect(object?.rotation).toBe(0);
  });

  it('rotates an object using horizontal hand movement', () => {
    controller.setTool('rotate');

    controller.handle(start(), width, height);
    controller.handle(move(0.24, 0.25), width, height);

    const object = scene.selectedObject();

    expect(object?.rotation).toBeCloseTo(0.04 * Math.PI * 2);

    expect(object?.width).toBe(120);
    expect(object?.height).toBe(80);
    expect(object?.center).toEqual({ x: 200, y: 200 });
  });

  it('cancels the current drag when changing tools', () => {
    controller.handle(start(), width, height);

    expect(controller.isDragging()).toBe(true);

    controller.setTool('rotate');

    expect(controller.isDragging()).toBe(false);
    expect(controller.tool()).toBe('rotate');

    const changed = controller.handle(move(0.25, 0.25), width, height);

    expect(changed).toBe(false);
    expect(scene.objects()[0].rotation).toBe(0);
  });
});
