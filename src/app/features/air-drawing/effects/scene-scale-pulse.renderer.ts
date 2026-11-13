import { SceneObject } from '../scene/scene.models';
import { SCALE_PULSE_DURATION_MS, ScalePulseSample } from './scene-scale-pulse.buffer';

export class SceneScalePulseRenderer {
  draw(ctx: CanvasRenderingContext2D, samples: readonly ScalePulseSample[], now: number): void {
    ctx.save();

    try {
      for (const sample of samples) {
        const age = now - sample.createdAt;

        if (age < 0 || age >= SCALE_PULSE_DURATION_MS) {
          continue;
        }

        const progress = age / SCALE_PULSE_DURATION_MS;

        const eased = 1 - Math.pow(1 - progress, 2);

        const padding = 8 + eased * 16;
        const opacity = 0.26 * Math.pow(1 - progress, 1.7);

        const object = sample.object;
        const color = this.getColor(object.kind);

        ctx.save();

        try {
          ctx.translate(object.center.x, object.center.y);

          ctx.rotate(object.rotation);

          ctx.globalAlpha = opacity;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;

          ctx.beginPath();

          if (object.kind === 'circle') {
            const radius = Math.min(object.width, object.height) / 2 + padding;

            ctx.arc(0, 0, radius, 0, Math.PI * 2);
          } else {
            const width = object.width + padding * 2;

            const height = object.height + padding * 2;

            ctx.roundRect(
              -width / 2,
              -height / 2,
              width,
              height,
              Math.min(12, width / 8, height / 8),
            );
          }

          ctx.stroke();
        } finally {
          ctx.restore();
        }
      }
    } finally {
      ctx.restore();
    }
  }

  private getColor(kind: SceneObject['kind']): string {
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
