import { Injectable, computed, signal } from '@angular/core';
import { DrawPoint } from '../drawing.models';
import { NewSceneObject, SceneObject } from './scene.models';

type ObjectTransform = Pick<SceneObject, 'width' | 'height' | 'rotation'>;

type VisualOffsetResolver = (object: SceneObject) => number;

@Injectable()
export class SceneStore {
  private readonly _objects = signal<readonly SceneObject[]>([]);
  private readonly _selectedId = signal<string | null>(null);

  readonly objects = this._objects.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();

  readonly selectedObject = computed(
    () => this._objects().find((object) => object.id === this._selectedId()) ?? null,
  );

  private nextId = 1;

  addObject(input: NewSceneObject): SceneObject {
    if (
      !Number.isFinite(input.center.x) ||
      !Number.isFinite(input.center.y) ||
      !Number.isFinite(input.width) ||
      !Number.isFinite(input.height) ||
      !Number.isFinite(input.rotation) ||
      input.width <= 0 ||
      input.height <= 0
    ) {
      throw new Error('Invalid scene object dimensions');
    }

    const object: SceneObject = {
      id: `scene-${this.nextId++}`,
      kind: input.kind,
      center: { ...input.center },
      width: input.width,
      height: input.height,
      rotation: input.rotation,
    };

    this._objects.update((objects) => [...objects, object]);
    this._selectedId.set(object.id);

    return object;
  }

  selectAt(point: DrawPoint, resolveVisualOffset?: VisualOffsetResolver): SceneObject | null {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      this._selectedId.set(null);
      return null;
    }

    const objects = this._objects();

    for (let i = objects.length - 1; i >= 0; i--) {
      const object = objects[i];

      const offset = resolveVisualOffset?.(object) ?? 0;

      if (this.containsPoint(object, point, offset)) {
        this._selectedId.set(object.id);
        return object;
      }
    }

    this._selectedId.set(null);
    return null;
  }

  moveSelectedBy(dx: number, dy: number): boolean {
    const selected = this.selectedObject();

    if (!selected || !Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
      return false;
    }

    const nextX = selected.center.x + dx;
    const nextY = selected.center.y + dy;

    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
      return false;
    }

    this._objects.update((objects) =>
      objects.map((object) =>
        object.id === selected.id
          ? {
              ...object,
              center: {
                x: nextX,
                y: nextY,
              },
            }
          : object,
      ),
    );

    return true;
  }

  setSelectedTransform(transform: ObjectTransform): boolean {
    const selected = this.selectedObject();

    if (
      !selected ||
      !Number.isFinite(transform.width) ||
      !Number.isFinite(transform.height) ||
      !Number.isFinite(transform.rotation) ||
      transform.width <= 0 ||
      transform.height <= 0
    ) {
      return false;
    }

    if (
      selected.width === transform.width &&
      selected.height === transform.height &&
      selected.rotation === transform.rotation
    ) {
      return false;
    }

    this._objects.update((objects) =>
      objects.map((object) =>
        object.id === selected.id
          ? {
              ...object,
              width: transform.width,
              height: transform.height,
              rotation: transform.rotation,
            }
          : object,
      ),
    );

    return true;
  }

  resizeViewport(
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number,
  ): boolean {
    if (
      ![oldWidth, oldHeight, newWidth, newHeight].every(
        (value) => Number.isFinite(value) && value > 0,
      )
    ) {
      return false;
    }

    if (oldWidth === newWidth && oldHeight === newHeight) {
      return false;
    }

    const scaleX = newWidth / oldWidth;
    const scaleY = newHeight / oldHeight;
    const sizeScale = Math.sqrt(scaleX * scaleY);

    if (
      !Number.isFinite(scaleX) ||
      !Number.isFinite(scaleY) ||
      !Number.isFinite(sizeScale) ||
      scaleX <= 0 ||
      scaleY <= 0 ||
      sizeScale <= 0
    ) {
      return false;
    }

    const updated = this._objects().map((object) => ({
      ...object,
      center: {
        x: object.center.x * scaleX,
        y: object.center.y * scaleY,
      },
      width: object.width * sizeScale,
      height: object.height * sizeScale,
    }));

    const valid = updated.every(
      (object) =>
        Number.isFinite(object.center.x) &&
        Number.isFinite(object.center.y) &&
        Number.isFinite(object.width) &&
        Number.isFinite(object.height) &&
        object.width > 0 &&
        object.height > 0,
    );

    if (!valid) {
      return false;
    }

    this._objects.set(updated);

    return true;
  }

  applyPhysicsPositions(positions: ReadonlyMap<string, DrawPoint>): boolean {
    if (positions.size === 0) {
      return false;
    }

    let changed = false;

    const updated = this._objects().map((object) => {
      const center = positions.get(object.id);

      if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
        return object;
      }

      if (
        Math.abs(center.x - object.center.x) < 0.001 &&
        Math.abs(center.y - object.center.y) < 0.001
      ) {
        return object;
      }

      changed = true;

      return {
        ...object,
        center: {
          x: center.x,
          y: center.y,
        },
      };
    });

    if (changed) {
      this._objects.set(updated);
    }

    return changed;
  }

  removeSelected(): boolean {
    const id = this._selectedId();

    if (!id) {
      return false;
    }

    const exists = this._objects().some((object) => object.id === id);

    if (!exists) {
      return false;
    }

    this._objects.update((objects) => objects.filter((object) => object.id !== id));

    this._selectedId.set(null);

    return true;
  }

  clearSelection(): void {
    this._selectedId.set(null);
  }

  clear(): void {
    this._objects.set([]);
    this._selectedId.set(null);
  }

  private containsPoint(object: SceneObject, point: DrawPoint, visualOffsetY = 0): boolean {
    const offset = Number.isFinite(visualOffsetY) ? visualOffsetY : 0;

    const dx = point.x - object.center.x;
    const dy = point.y - object.center.y - offset;

    const cos = Math.cos(object.rotation);
    const sin = Math.sin(object.rotation);

    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;

    const padding = 8;

    if (object.kind === 'circle') {
      const radius = Math.min(object.width, object.height) / 2 + padding;

      return Math.hypot(localX, localY) <= radius;
    }

    return (
      Math.abs(localX) <= object.width / 2 + padding &&
      Math.abs(localY) <= object.height / 2 + padding
    );
  }
}
