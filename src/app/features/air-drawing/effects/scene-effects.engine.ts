import { InteractionTool, SceneObject } from '../scene/scene.models';
import { SceneRenderer } from '../scene/scene.renderer';
import { SceneCreationEffectsRenderer } from './scene-creation-effects.renderer';
import { SceneMotionTrailBuffer } from './scene-motion-trail.buffer';
import { SceneMotionTrailRenderer } from './scene-motion-trail.renderer';
import { SceneRotationOrbitBuffer } from './scene-rotation-orbit.buffer';
import { SceneRotationOrbitRenderer } from './scene-rotation-orbit.renderer';
import { SceneScalePulseBuffer } from './scene-scale-pulse.buffer';
import { SceneScalePulseRenderer } from './scene-scale-pulse.renderer';

const CREATION_DURATION_MS = 1100;

export interface SceneEffectsSnapshot {
  readonly objects: readonly SceneObject[];
  readonly selected: SceneObject | null;
  readonly tool: InteractionTool;
  readonly dragging: boolean;
  readonly now: number;
  readonly maxJump: number;
}

export class SceneEffectsEngine {
  private readonly seenIds = new Set<string>();
  private readonly creations = new Map<string, number>();

  private readonly trail = new SceneMotionTrailBuffer();
  private readonly scale = new SceneScalePulseBuffer();
  private readonly orbit = new SceneRotationOrbitBuffer();

  private readonly creationRenderer = new SceneCreationEffectsRenderer();

  private readonly trailRenderer: SceneMotionTrailRenderer;
  private readonly scaleRenderer = new SceneScalePulseRenderer();
  private readonly orbitRenderer = new SceneRotationOrbitRenderer();

  constructor(sceneRenderer: SceneRenderer) {
    this.trailRenderer = new SceneMotionTrailRenderer(sceneRenderer);
  }

  sync(snapshot: SceneEffectsSnapshot, reducedMotion: boolean): void {
    const ids = new Set(snapshot.objects.map((object) => object.id));

    for (const id of this.seenIds) {
      if (!ids.has(id)) {
        this.seenIds.delete(id);
        this.creations.delete(id);
      }
    }

    for (const object of snapshot.objects) {
      if (this.seenIds.has(object.id)) {
        continue;
      }

      this.seenIds.add(object.id);

      if (!reducedMotion) {
        this.creations.set(object.id, snapshot.now);
      }
    }

    this.trail.prune(ids);
    this.scale.prune(ids);
    this.orbit.prune(ids);

    if (reducedMotion) {
      this.clearAnimations();
      return;
    }

    this.trail.observe(
      snapshot.selected,
      snapshot.dragging && snapshot.tool === 'move',
      snapshot.now,
      snapshot.maxJump,
    );

    this.scale.observe(
      snapshot.selected,
      snapshot.dragging && snapshot.tool === 'scale',
      snapshot.now,
    );

    this.orbit.observe(
      snapshot.selected,
      snapshot.dragging && snapshot.tool === 'rotate',
      snapshot.now,
    );
  }

  render(ctx: CanvasRenderingContext2D, objects: readonly SceneObject[], now: number): void {
    this.expire(now);

    this.trailRenderer.draw(ctx, this.trail.samples, now);

    for (const [id, startedAt] of this.creations) {
      const object = objects.find((item) => item.id === id);

      if (!object) {
        continue;
      }

      const progress = (now - startedAt) / CREATION_DURATION_MS;

      this.creationRenderer.draw(ctx, object, progress);
    }

    this.scaleRenderer.draw(ctx, this.scale.samples, now);

    const orbit = this.orbit.sample;

    if (orbit) {
      const current = objects.find((object) => object.id === orbit.object.id);

      if (current) {
        this.orbitRenderer.draw(
          ctx,
          {
            ...orbit,
            object: current,
          },
          now,
        );
      }
    }
  }

  expire(now: number): void {
    for (const [id, startedAt] of this.creations) {
      if (now - startedAt >= CREATION_DURATION_MS) {
        this.creations.delete(id);
      }
    }

    this.trail.expire(now);
    this.scale.expire(now);
    this.orbit.expire(now);
  }

  hasActiveEffects(): boolean {
    return (
      this.creations.size > 0 ||
      this.trail.samples.length > 0 ||
      this.scale.samples.length > 0 ||
      this.orbit.sample !== null
    );
  }

  clearAnimations(): void {
    this.creations.clear();
    this.trail.clear();
    this.scale.clear();
    this.orbit.clear();
  }

  reset(): void {
    this.clearAnimations();
    this.seenIds.clear();
  }
}
