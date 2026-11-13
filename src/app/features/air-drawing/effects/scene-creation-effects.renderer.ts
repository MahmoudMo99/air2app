import { SceneObject } from '../scene/scene.models';

export class SceneCreationEffectsRenderer {
  draw(ctx: CanvasRenderingContext2D, object: SceneObject, progress: number): void {
    const t = Math.max(0, Math.min(1, progress));
    const fade = Math.pow(1 - t, 1.4);
    const entrance = Math.min(1, t * 10);
    const color = this.getColor(object.kind);

    ctx.save();

    try {
      ctx.translate(object.center.x, object.center.y);
      ctx.rotate(object.rotation);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.globalAlpha = fade * entrance;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 22;

      const reveal = Math.min(1, t / 0.58);

      this.drawOutline(ctx, object, 5, reveal);

      ctx.shadowBlur = 0;

      for (let i = 0; i < 2; i++) {
        const wave = (t - i * 0.12) / 0.72;

        if (wave < 0 || wave >= 1) {
          continue;
        }

        const eased = 1 - Math.pow(1 - wave, 3);

        ctx.globalAlpha = Math.pow(1 - wave, 2) * 0.48;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;

        this.drawOutline(ctx, object, 12 + eased * 32, 1);
      }

      this.drawParticles(ctx, object, t, color);
    } finally {
      ctx.restore();
    }
  }

  private drawOutline(
    ctx: CanvasRenderingContext2D,
    object: SceneObject,
    padding: number,
    reveal: number,
  ): void {
    ctx.beginPath();
    ctx.setLineDash([]);

    if (object.kind === 'circle') {
      const radius = Math.min(object.width, object.height) / 2 + padding;

      ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * reveal);
    } else {
      const width = object.width + padding * 2;
      const height = object.height + padding * 2;

      ctx.roundRect(-width / 2, -height / 2, width, height, Math.min(14, width / 8, height / 8));

      if (reveal < 1) {
        const perimeter = 2 * (width + height);

        ctx.setLineDash([perimeter * reveal, perimeter]);
      }
    }

    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawParticles(
    ctx: CanvasRenderingContext2D,
    object: SceneObject,
    progress: number,
    color: string,
  ): void {
    const count = 14;
    const eased = 1 - Math.pow(1 - progress, 3);
    const radius = Math.max(object.width, object.height) * 0.48;

    const opacity = Math.min(1, progress * 12) * Math.pow(1 - progress, 1.8);

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.12;

      const travel = radius + 8 + eased * (28 + (i % 4) * 9);

      const x = Math.cos(angle) * travel;
      const y = Math.sin(angle) * travel;

      const size = (1.5 + (i % 3) * 0.55) * Math.max(0.25, 1 - progress);

      ctx.globalAlpha = opacity * (0.65 + (i % 3) * 0.15);

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }

  private getColor(kind: SceneObject['kind']): string {
    switch (kind) {
      case 'circle':
        return '#52f5d0';
      case 'square':
        return '#a9beff';
      case 'rectangle':
        return '#ffc78a';
    }
  }
}
