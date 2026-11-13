import { Injectable } from '@angular/core';
import { LivingObjectsMotion } from '../effects/living-objects.motion';
import { SceneObject } from './scene.models';

@Injectable()
export class SceneRenderer {
  private livingMotion: LivingObjectsMotion | null = null;

  setLivingMotion(motion: LivingObjectsMotion): void {
    this.livingMotion = motion;
  }

  render(
    ctx: CanvasRenderingContext2D,
    object: SceneObject,
    color: string,
    strokeWidth: number,
  ): void {
    ctx.save();

    try {
      const offset = this.livingMotion?.offsetFor(object) ?? 0;

      ctx.translate(object.center.x, object.center.y + offset);

      ctx.rotate(object.rotation);

      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;

      ctx.beginPath();

      if (object.kind === 'circle') {
        ctx.arc(0, 0, Math.min(object.width, object.height) / 2, 0, Math.PI * 2);
      } else {
        const radius = Math.min(12, object.width / 8, object.height / 8);

        ctx.roundRect(-object.width / 2, -object.height / 2, object.width, object.height, radius);
      }

      ctx.stroke();
    } finally {
      ctx.restore();
    }
  }

  renderSelection(ctx: CanvasRenderingContext2D, object: SceneObject): void {
    const padding = 11;

    ctx.save();

    try {
      const offset = this.livingMotion?.offsetFor(object) ?? 0;

      ctx.translate(object.center.x, object.center.y + offset);

      ctx.rotate(object.rotation);

      ctx.strokeStyle = '#a9beff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#7595ff';
      ctx.shadowBlur = 10;

      ctx.beginPath();

      if (object.kind === 'circle') {
        ctx.arc(0, 0, Math.min(object.width, object.height) / 2 + padding, 0, Math.PI * 2);
      } else {
        ctx.roundRect(
          -object.width / 2 - padding,
          -object.height / 2 - padding,
          object.width + padding * 2,
          object.height + padding * 2,
          9,
        );
      }

      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#f4f7ff';
      ctx.lineWidth = 2.5;

      const handles =
        object.kind === 'circle'
          ? this.circleHandles(object, padding)
          : this.rectangleHandles(object, padding);

      for (const handle of handles) {
        ctx.beginPath();

        ctx.arc(handle.x, handle.y, 4.5, 0, Math.PI * 2);

        ctx.stroke();
      }
    } finally {
      ctx.restore();
    }
  }

  private circleHandles(object: SceneObject, padding: number): { x: number; y: number }[] {
    const radius = Math.min(object.width, object.height) / 2 + padding;

    return [
      { x: 0, y: -radius },
      { x: radius, y: 0 },
      { x: 0, y: radius },
      { x: -radius, y: 0 },
    ];
  }

  private rectangleHandles(object: SceneObject, padding: number): { x: number; y: number }[] {
    const halfWidth = object.width / 2 + padding;
    const halfHeight = object.height / 2 + padding;

    return [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight },
    ];
  }
}
