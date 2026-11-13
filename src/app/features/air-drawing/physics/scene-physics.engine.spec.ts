import { describe, expect, it } from 'vitest';
import { SceneObject } from '../scene/scene.models';
import { ScenePhysicsEngine } from './scene-physics.engine';

describe('ScenePhysicsEngine', () => {
  const circle: SceneObject = {
    id: 'scene-1',
    kind: 'circle',
    center: { x: 250, y: 100 },
    width: 60,
    height: 60,
    rotation: 0,
  };

  const viewport = {
    width: 500,
    height: 400,
  };

  it('moves an object downward under gravity', () => {
    const engine = new ScenePhysicsEngine();

    const result = engine.step([circle], viewport, 1 / 60);

    const position = result.positions.get(circle.id);

    expect(position).toBeDefined();
    expect(position!.y).toBeGreaterThan(100);
    expect(position!.x).toBe(250);
    expect(result.awake).toBe(true);
  });

  it('bounces after reaching the floor', () => {
    const engine = new ScenePhysicsEngine();

    let object = circle;
    let reachedFloor = false;
    let bounced = false;

    for (let i = 0; i < 360; i++) {
      const previousY = object.center.y;

      const result = engine.step([object], viewport, 1 / 60);

      const next = result.positions.get(object.id);

      if (next) {
        object = {
          ...object,
          center: next,
        };
      }

      if (Math.abs(object.center.y - 370) < 0.001) {
        reachedFloor = true;
      }

      if (reachedFloor && object.center.y < previousY - 0.001) {
        bounced = true;
      }
    }

    expect(reachedFloor).toBe(true);
    expect(bounced).toBe(true);
  });

  it('eventually settles on the floor', () => {
    const engine = new ScenePhysicsEngine();

    let object = circle;
    let awake = true;

    for (let i = 0; i < 900; i++) {
      const result = engine.step([object], viewport, 1 / 60);

      const next = result.positions.get(object.id);

      if (next) {
        object = {
          ...object,
          center: next,
        };
      }

      awake = result.awake;
    }

    expect(object.center.y).toBeCloseTo(370, 2);
    expect(awake).toBe(false);
  });

  it('respects the rotated bounds of a rectangle', () => {
    const engine = new ScenePhysicsEngine();

    const rectangle: SceneObject = {
      id: 'scene-2',
      kind: 'rectangle',
      center: { x: 490, y: 390 },
      width: 200,
      height: 100,
      rotation: Math.PI / 4,
    };

    const result = engine.step([rectangle], viewport, 1 / 60);

    const position = result.positions.get(rectangle.id);

    const extent = (200 * Math.sin(Math.PI / 4) + 100 * Math.cos(Math.PI / 4)) / 2;

    expect(position).toBeDefined();
    expect(position!.x).toBeLessThanOrEqual(viewport.width - extent);

    expect(position!.y).toBeLessThanOrEqual(viewport.height - extent);
  });

  it('does not mutate the original scene object', () => {
    const engine = new ScenePhysicsEngine();

    engine.step([circle], viewport, 1 / 60);

    expect(circle.center).toEqual({
      x: 250,
      y: 100,
    });

    expect(circle.width).toBe(60);
    expect(circle.height).toBe(60);
  });

  it('sleeps when an object is already resting on the floor', () => {
    const engine = new ScenePhysicsEngine();

    const resting: SceneObject = {
      ...circle,
      center: {
        x: 250,
        y: 370,
      },
    };

    const result = engine.step([resting], viewport, 1 / 60);

    expect(result.positions.size).toBe(0);
    expect(result.awake).toBe(false);
  });

  it('clamps objects when the viewport becomes shorter', () => {
    const engine = new ScenePhysicsEngine();

    const resting: SceneObject = {
      ...circle,
      center: {
        x: 250,
        y: 370,
      },
    };

    const smallerViewport = {
      width: 500,
      height: 300,
    };

    const first = engine.step([resting], smallerViewport, 1 / 60);

    expect(first.positions.get(circle.id)?.y).toBe(270);
    expect(first.awake).toBe(false);

    const updated: SceneObject = {
      ...resting,
      center: first.positions.get(circle.id)!,
    };

    const second = engine.step([updated], smallerViewport, 1 / 60);

    expect(second.positions.size).toBe(0);
    expect(second.awake).toBe(false);
  });

  it('resumes falling when the viewport becomes taller', () => {
    const engine = new ScenePhysicsEngine();

    const resting: SceneObject = {
      ...circle,
      center: {
        x: 250,
        y: 270,
      },
    };

    const result = engine.step([resting], viewport, 1 / 60);

    expect(result.positions.get(circle.id)?.y).toBeGreaterThan(270);
    expect(result.awake).toBe(true);
  });

  it('caps large frame delays to keep physics stable', () => {
    const firstEngine = new ScenePhysicsEngine();
    const secondEngine = new ScenePhysicsEngine();

    const delayed = firstEngine.step([circle], viewport, 10);

    const capped = secondEngine.step([circle], viewport, 0.05);

    expect(delayed.positions.get(circle.id)?.y).toBeCloseTo(capped.positions.get(circle.id)!.y, 6);

    expect(delayed.awake).toBe(capped.awake);
  });

  it('removes velocity state for deleted objects', () => {
    const engine = new ScenePhysicsEngine();
    const freshEngine = new ScenePhysicsEngine();

    engine.step([circle], viewport, 1 / 60);

    engine.step([], viewport, 1 / 60);

    const recreated = engine.step([circle], viewport, 1 / 60);

    const fresh = freshEngine.step([circle], viewport, 1 / 60);

    expect(recreated.positions.get(circle.id)?.y).toBeCloseTo(fresh.positions.get(circle.id)!.y, 6);
  });
});
