import { SceneObject } from '../scene/scene.models';
import { ROTATION_ORBIT_DURATION_MS, RotationOrbitSample } from './scene-rotation-orbit.buffer';

export class SceneRotationOrbitRenderer {
  draw(ctx: CanvasRenderingContext2D, sample: RotationOrbitSample, now: number): void {
    const age = now - sample.createdAt;

    if (age < 0 || age >= ROTATION_ORBIT_DURATION_MS) {
      return;
    }

    const progress = age / ROTATION_ORBIT_DURATION_MS;

    const fade = Math.pow(1 - progress, 1.6);

    const object = sample.object;
    const color = this.getColor(object.kind);

    const isCircle = object.kind === 'circle';

    const radiusX = isCircle
      ? Math.min(object.width, object.height) / 2 + 19
      : object.width / 2 + 19;

    const radiusY = isCircle ? radiusX : object.height / 2 + 19;

    const travel = progress * Math.PI * 1.6 * sample.direction;

    ctx.save();

    try {
      ctx.translate(object.center.x, object.center.y);

      ctx.rotate(object.rotation);

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 7;

      const dots = [
        { size: 2.2, opacity: 0.36 },
        { size: 1.7, opacity: 0.27 },
        { size: 1.3, opacity: 0.2 },
      ];

      for (let i = 0; i < dots.length; i++) {
        const angle = travel + (i * Math.PI * 2) / dots.length;

        const x = Math.cos(angle) * radiusX;
        const y = Math.sin(angle) * radiusY;

        const dot = dots[i];

        ctx.globalAlpha = dot.opacity * fade * sample.intensity;

        ctx.beginPath();

        ctx.arc(x, y, dot.size, 0, Math.PI * 2);

        ctx.fill();
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
