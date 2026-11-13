import { SceneObject } from '../scene/scene.models';

export const SCALE_PULSE_DURATION_MS = 460;

export interface ScalePulseSample {
  readonly object: SceneObject;
  readonly createdAt: number;
}

export class SceneScalePulseBuffer {
  private readonly maxSamples = 2;
  private readonly minInterval = 140;
  private readonly minChange = 0.018;

  private anchor: SceneObject | null = null;
  private lastPulseAt = Number.NEGATIVE_INFINITY;
  private history: ScalePulseSample[] = [];

  get samples(): readonly ScalePulseSample[] {
    return this.history;
  }

  observe(object: SceneObject | null, scaling: boolean, now: number): boolean {
    if (
      !object ||
      !Number.isFinite(now) ||
      !Number.isFinite(object.width) ||
      !Number.isFinite(object.height) ||
      object.width <= 0 ||
      object.height <= 0
    ) {
      this.anchor = null;
      return false;
    }

    if (!scaling) {
      this.anchor = object;
      this.lastPulseAt = Number.NEGATIVE_INFINITY;
      return false;
    }

    const previous = this.anchor;

    if (!previous || previous.id !== object.id) {
      this.anchor = object;
      this.lastPulseAt = Number.NEGATIVE_INFINITY;
      return false;
    }

    const widthChange = Math.abs(Math.log(object.width / previous.width));

    const heightChange = Math.abs(Math.log(object.height / previous.height));

    const change = Math.max(widthChange, heightChange);

    if (change < this.minChange || now - this.lastPulseAt < this.minInterval) {
      return false;
    }

    this.anchor = object;
    this.lastPulseAt = now;

    this.history.push({
      object: {
        ...object,
        center: { ...object.center },
      },
      createdAt: now,
    });

    if (this.history.length > this.maxSamples) {
      this.history.splice(0, this.history.length - this.maxSamples);
    }

    return true;
  }

  expire(now: number): void {
    this.history = this.history.filter(
      (sample) => now - sample.createdAt < SCALE_PULSE_DURATION_MS,
    );
  }

  prune(ids: ReadonlySet<string>): void {
    this.history = this.history.filter((sample) => ids.has(sample.object.id));

    if (this.anchor && !ids.has(this.anchor.id)) {
      this.anchor = null;
    }
  }

  clear(): void {
    this.anchor = null;
    this.lastPulseAt = Number.NEGATIVE_INFINITY;
    this.history = [];
  }
}
