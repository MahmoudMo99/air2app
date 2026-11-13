import { SceneObject } from '../scene/scene.models';
import { SceneRenderer } from '../scene/scene.renderer';
import { MOTION_TRAIL_DURATION_MS, MotionTrailSample } from './scene-motion-trail.buffer';

export class SceneMotionTrailRenderer {
  constructor(private readonly sceneRenderer: SceneRenderer) {}

  draw(ctx: CanvasRenderingContext2D, samples: readonly MotionTrailSample[], now: number): void {
    ctx.save();

    try {
      for (const sample of samples) {
        const age = now - sample.createdAt;

        const life = Math.max(0, Math.min(1, 1 - age / MOTION_TRAIL_DURATION_MS));

        if (life <= 0) {
          continue;
        }

        const color = this.colorFor(sample.object.kind);

        ctx.globalAlpha = 0.34 * Math.pow(life, 1.7);

        this.sceneRenderer.render(ctx, sample.object, color, 2.4);

        ctx.save();

        try {
          ctx.globalAlpha = 0.55 * life * life;
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 13 * life;

          ctx.beginPath();
          ctx.arc(sample.object.center.x, sample.object.center.y, 1.2 + 1.8 * life, 0, Math.PI * 2);

          ctx.fill();
        } finally {
          ctx.restore();
        }
      }
    } finally {
      ctx.restore();
    }
  }

  private colorFor(kind: SceneObject['kind']): string {
    switch (kind) {
      case 'circle':
        return '#52f5d0';
      case 'square':
        return '#a9beff';
      case 'rectangle':
        return '#ffc78a';
      default:
        return '#a9beff';
    }
  }
}
