import { Injectable } from '@angular/core';
import { SceneObject } from '../scene/scene.models';

@Injectable()
export class LivingObjectsMotion {
  private active = false;
  private startedAt = 0;
  private frameTime = 0;
  private viewportHeight = 720;

  get isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean, now: number): boolean {
    if (this.active === active) {
      return false;
    }

    this.active = active;

    if (active) {
      this.startedAt = now;
      this.frameTime = now;
    }

    return true;
  }

  advance(now: number, viewportHeight: number): void {
    if (Number.isFinite(now)) {
      this.frameTime = now;
    }

    if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
      this.viewportHeight = viewportHeight;
    }
  }

  offsetFor(object: SceneObject): number {
    if (!this.active) {
      return 0;
    }

    const elapsed = Math.max(0, this.frameTime - this.startedAt);

    const entrance = Math.min(1, elapsed / 420);

    const amplitude = Math.min(5.5, Math.max(2.5, this.viewportHeight * 0.007));

    const phase = this.phaseFor(object.id);

    return Math.sin(this.frameTime / 1450 + phase) * amplitude * entrance;
  }

  private phaseFor(id: string): number {
    let hash = 0;

    for (let i = 0; i < id.length; i++) {
      hash = (Math.imul(hash, 31) + id.charCodeAt(i)) | 0;
    }

    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b);
    hash ^= hash >>> 16;

    return ((hash >>> 0) / 4294967296) * Math.PI * 2;
  }
}
