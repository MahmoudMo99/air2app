import { describe, expect, it } from 'vitest';
import { InteractionTool, SceneObject } from '../scene/scene.models';
import { SceneRenderer } from '../scene/scene.renderer';
import { SceneEffectsEngine, SceneEffectsSnapshot } from './scene-effects.engine';

describe('SceneEffectsEngine', () => {
  const circle: SceneObject = {
    id: 'scene-1',
    kind: 'circle',
    center: { x: 200, y: 200 },
    width: 120,
    height: 120,
    rotation: 0,
  };

  function createEngine(): SceneEffectsEngine {
    return new SceneEffectsEngine(new SceneRenderer());
  }

  function snapshot(
    objects: readonly SceneObject[],
    selected: SceneObject | null,
    tool: InteractionTool = 'move',
    dragging = false,
    now = 0,
  ): SceneEffectsSnapshot {
    return {
      objects,
      selected,
      tool,
      dragging,
      now,
      maxJump: 100,
    };
  }

  it('starts a creation effect for a new object', () => {
    const engine = createEngine();

    engine.sync(snapshot([circle], circle), false);

    expect(engine.hasActiveEffects()).toBe(true);

    engine.expire(1200);

    expect(engine.hasActiveEffects()).toBe(false);
  });

  it('does not replay creation effects after updating an object', () => {
    const engine = createEngine();

    engine.sync(snapshot([circle], circle), false);
    engine.expire(1200);

    const updated: SceneObject = {
      ...circle,
      center: { x: 230, y: 220 },
    };

    engine.sync(snapshot([updated], updated, 'move', false, 1300), false);

    expect(engine.hasActiveEffects()).toBe(false);
  });

  it('creates a trail only during Move interaction', () => {
    const engine = createEngine();

    engine.sync(snapshot([circle], circle), false);
    engine.expire(1200);

    const moved: SceneObject = {
      ...circle,
      center: { x: 220, y: 200 },
    };

    engine.sync(snapshot([circle], circle, 'scale', true, 1300), false);

    engine.sync(snapshot([moved], moved, 'scale', true, 1320), false);

    expect(engine.hasActiveEffects()).toBe(false);

    engine.sync(snapshot([moved], moved, 'move', true, 1400), false);

    const movedAgain: SceneObject = {
      ...moved,
      center: { x: 245, y: 200 },
    };

    engine.sync(snapshot([movedAgain], movedAgain, 'move', true, 1420), false);

    expect(engine.hasActiveEffects()).toBe(true);

    engine.expire(2100);

    expect(engine.hasActiveEffects()).toBe(false);
  });

  it('generates an energy pulse during Scale interaction', () => {
    const engine = createEngine();

    engine.sync(snapshot([circle], circle), false);
    engine.expire(1200);

    engine.sync(snapshot([circle], circle, 'scale', true, 1300), false);

    const scaled: SceneObject = {
      ...circle,
      width: 150,
      height: 150,
    };

    engine.sync(snapshot([scaled], scaled, 'scale', true, 1330), false);

    expect(engine.hasActiveEffects()).toBe(true);

    engine.expire(1900);

    expect(engine.hasActiveEffects()).toBe(false);
  });

  it('generates an orbit during Rotate interaction', () => {
    const engine = createEngine();

    engine.sync(snapshot([circle], circle), false);
    engine.expire(1200);

    engine.sync(snapshot([circle], circle, 'rotate', true, 1300), false);

    const rotated: SceneObject = {
      ...circle,
      rotation: 0.12,
    };

    engine.sync(snapshot([rotated], rotated, 'rotate', true, 1330), false);

    expect(engine.hasActiveEffects()).toBe(true);

    engine.expire(1800);

    expect(engine.hasActiveEffects()).toBe(false);
  });

  it('disables animations when reduced motion is enabled', () => {
    const engine = createEngine();

    engine.sync(snapshot([circle], circle), true);

    expect(engine.hasActiveEffects()).toBe(false);

    engine.sync(snapshot([circle], circle, 'move', true, 1300), true);

    expect(engine.hasActiveEffects()).toBe(false);
  });

  it('removes effects when objects are deleted', () => {
    const engine = createEngine();

    engine.sync(snapshot([circle], circle), false);

    expect(engine.hasActiveEffects()).toBe(true);

    engine.sync(snapshot([], null, 'move', false, 50), false);

    expect(engine.hasActiveEffects()).toBe(false);
  });

  it('can restart creation effects after a full reset', () => {
    const engine = createEngine();

    engine.sync(snapshot([circle], circle), false);
    engine.expire(1200);

    expect(engine.hasActiveEffects()).toBe(false);

    engine.reset();

    engine.sync(snapshot([circle], circle, 'move', false, 1300), false);

    expect(engine.hasActiveEffects()).toBe(true);
  });
});
