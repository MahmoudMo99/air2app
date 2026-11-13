import { Injectable, inject, signal } from '@angular/core';
import { DrawPoint, GestureFrame } from '../drawing.models';
import { LivingObjectsMotion } from '../effects/living-objects.motion';
import { distance } from '../geometry.utils';
import { InteractionTool, SceneObject } from './scene.models';
import { SceneStore } from './scene.store';

@Injectable()
export class ObjectInteractionController {
  private readonly scene = inject(SceneStore);

  private readonly livingMotion = inject(LivingObjectsMotion, { optional: true });

  readonly isDragging = signal(false);
  readonly tool = signal<InteractionTool>('move');

  private lastCursor: DrawPoint | null = null;
  private startCursor: DrawPoint | null = null;
  private initialObject: SceneObject | null = null;

  setTool(tool: InteractionTool): void {
    if (this.tool() === tool) {
      return;
    }

    this.cancel();
    this.tool.set(tool);
  }

  handle(gesture: GestureFrame, canvasWidth: number, canvasHeight: number): boolean {
    if (
      !Number.isFinite(canvasWidth) ||
      !Number.isFinite(canvasHeight) ||
      canvasWidth <= 0 ||
      canvasHeight <= 0
    ) {
      this.cancel();
      return false;
    }

    if (gesture.active && gesture.action === 'pause') {
      return false;
    }

    if (
      !gesture.active ||
      !gesture.cursor ||
      gesture.action === 'end' ||
      gesture.action === 'idle'
    ) {
      this.cancel();
      return false;
    }

    const { x, y } = gesture.cursor;

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      this.cancel();
      return false;
    }

    const cursor: DrawPoint = {
      x: Math.max(0, Math.min(1, x)) * canvasWidth,
      y: Math.max(0, Math.min(1, y)) * canvasHeight,
    };

    if (gesture.action === 'start') {
      const selected = this.scene.selectAt(
        cursor,
        (object) => this.livingMotion?.offsetFor(object) ?? 0,
      );

      this.startCursor = selected ? cursor : null;
      this.lastCursor = selected ? cursor : null;
      this.initialObject = selected;

      this.isDragging.set(Boolean(selected));

      return true;
    }

    if (
      gesture.action !== 'draw' ||
      !this.isDragging() ||
      !this.lastCursor ||
      !this.startCursor ||
      !this.initialObject
    ) {
      return false;
    }

    const movement = distance(cursor, this.lastCursor);

    const maxMovement = Math.hypot(canvasWidth, canvasHeight) * 0.12;

    if (movement > maxMovement) {
      this.cancel();
      return false;
    }

    if (movement < 0.5) {
      return false;
    }

    const dx = cursor.x - this.lastCursor.x;
    const dy = cursor.y - this.lastCursor.y;

    this.lastCursor = cursor;

    if (this.tool() === 'move') {
      return this.scene.moveSelectedBy(dx, dy);
    }

    const initial = this.initialObject;

    if (this.tool() === 'scale') {
      const verticalDistance = this.startCursor.y - cursor.y;

      const sensitivity = Math.max(canvasHeight * 0.25, 1);

      const factor = Math.max(0.35, Math.min(3, Math.exp(verticalDistance / sensitivity)));

      return this.scene.setSelectedTransform({
        width: initial.width * factor,
        height: initial.height * factor,
        rotation: initial.rotation,
      });
    }

    const horizontalDistance = cursor.x - this.startCursor.x;

    const angle = (horizontalDistance / canvasWidth) * Math.PI * 2;

    return this.scene.setSelectedTransform({
      width: initial.width,
      height: initial.height,
      rotation: initial.rotation + angle,
    });
  }

  cancel(): void {
    this.lastCursor = null;
    this.startCursor = null;
    this.initialObject = null;
    this.isDragging.set(false);
  }

  reset(): void {
    this.cancel();
    this.scene.clearSelection();
  }
}
