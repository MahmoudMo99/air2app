import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GestureFrame } from '../drawing.models';
import { ObjectInteractionController } from './object-interaction.controller';
import { SceneStore } from './scene.store';

describe('ObjectInteractionController tracking recovery', () => {
  let scene: SceneStore;
  let controller: ObjectInteractionController;

  function frame(action: GestureFrame['action'], x: number | null, active = true): GestureFrame {
    return {
      active,
      action,
      cursor: x === null ? null : { x, y: 0.5 },
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SceneStore, ObjectInteractionController],
    });

    scene = TestBed.inject(SceneStore);
    controller = TestBed.inject(ObjectInteractionController);

    scene.addObject({
      kind: 'circle',
      center: { x: 300, y: 300 },
      width: 100,
      height: 100,
      rotation: 0,
    });
  });

  it('keeps dragging through a temporary tracking pause', () => {
    controller.handle(frame('start', 0.5), 600, 600);

    expect(controller.isDragging()).toBe(true);

    const paused = controller.handle(frame('pause', null), 600, 600);

    expect(paused).toBe(false);
    expect(controller.isDragging()).toBe(true);

    const resumed = controller.handle(frame('draw', 0.55), 600, 600);

    expect(resumed).toBe(true);
    expect(scene.selectedObject()?.center.x).toBeCloseTo(330, 5);
  });

  it('ends dragging when tracking loss becomes final', () => {
    controller.handle(frame('start', 0.5), 600, 600);

    controller.handle(frame('pause', null), 600, 600);

    controller.handle(frame('end', null, false), 600, 600);

    expect(controller.isDragging()).toBe(false);

    const changed = controller.handle(frame('draw', 0.55), 600, 600);

    expect(changed).toBe(false);
    expect(scene.selectedObject()?.center.x).toBe(300);
  });
});
