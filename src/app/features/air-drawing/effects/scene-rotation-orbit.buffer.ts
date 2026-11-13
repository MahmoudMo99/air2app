import { SceneObject } from '../scene/scene.models';

export const ROTATION_ORBIT_DURATION_MS = 420;

export interface RotationOrbitSample {
  readonly object: SceneObject;
  readonly createdAt: number;
  readonly direction: -1 | 1;
  readonly intensity: number;
}

export class SceneRotationOrbitBuffer {
  private readonly minRotation = 0.016;
  private readonly maxRotationJump = 0.75;

  private anchor: SceneObject | null = null;
  private current: RotationOrbitSample | null = null;

  get sample(): RotationOrbitSample | null {
    return this.current;
  }

  observe(object: SceneObject | null, rotating: boolean, now: number): boolean {
    if (!object) {
      this.clear();
      return false;
    }

    if (!Number.isFinite(now)) {
      return false;
    }

    if (!rotating) {
      this.anchor = object;
      return false;
    }

    const previous = this.anchor;

    if (!previous || previous.id !== object.id) {
      this.anchor = object;
      return false;
    }

    const change = object.rotation - previous.rotation;
    const magnitude = Math.abs(change);

    if (!Number.isFinite(change) || magnitude < this.minRotation) {
      return false;
    }

    this.anchor = object;

    if (magnitude > this.maxRotationJump) {
      return false;
    }

    this.current = {
      object: {
        ...object,
        center: { ...object.center },
      },
      createdAt: now,
      direction: change > 0 ? 1 : -1,
      intensity: Math.min(1, 0.6 + magnitude * 5),
    };

    return true;
  }

  expire(now: number): void {
    if (this.current && now - this.current.createdAt >= ROTATION_ORBIT_DURATION_MS) {
      this.current = null;
    }
  }

  prune(ids: ReadonlySet<string>): void {
    if (this.anchor && !ids.has(this.anchor.id)) {
      this.anchor = null;
    }

    if (this.current && !ids.has(this.current.object.id)) {
      this.current = null;
    }
  }

  clear(): void {
    this.anchor = null;
    this.current = null;
  }
}
