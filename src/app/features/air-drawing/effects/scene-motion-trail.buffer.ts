import { SceneObject } from '../scene/scene.models';

export const MOTION_TRAIL_DURATION_MS = 560;

export interface MotionTrailSample {
  readonly object: SceneObject;
  readonly createdAt: number;
}

export class SceneMotionTrailBuffer {
  private readonly maxSamples = 12;
  private readonly minDistance = 5;

  private previous: SceneObject | null = null;
  private history: MotionTrailSample[] = [];

  get samples(): readonly MotionTrailSample[] {
    return this.history;
  }

  observe(object: SceneObject | null, moving: boolean, now: number, maxJump: number): boolean {
    if (!object || !moving) {
      this.previous = object;
      return false;
    }

    const previous = this.previous;

    if (!previous || previous.id !== object.id) {
      this.previous = object;
      return false;
    }

    const dx = object.center.x - previous.center.x;
    const dy = object.center.y - previous.center.y;
    const movement = Math.hypot(dx, dy);

    if (movement < this.minDistance) {
      return false;
    }

    this.previous = object;

    if (!Number.isFinite(movement) || !Number.isFinite(maxJump) || movement > maxJump) {
      return false;
    }

    this.history.push({
      object: previous,
      createdAt: now,
    });

    if (this.history.length > this.maxSamples) {
      this.history.splice(0, this.history.length - this.maxSamples);
    }

    return true;
  }

  expire(now: number): void {
    this.history = this.history.filter(
      (sample) => now - sample.createdAt < MOTION_TRAIL_DURATION_MS,
    );
  }

  prune(ids: ReadonlySet<string>): void {
    this.history = this.history.filter((sample) => ids.has(sample.object.id));

    if (this.previous && !ids.has(this.previous.id)) {
      this.previous = null;
    }
  }

  clear(): void {
    this.previous = null;
    this.history = [];
  }
}
