import { DrawPoint } from '../drawing.models';
import { SceneObject } from '../scene/scene.models';

export interface PhysicsViewport {
  readonly width: number;
  readonly height: number;
}

export interface PhysicsStepResult {
  readonly positions: ReadonlyMap<string, DrawPoint>;
  readonly awake: boolean;
}

interface BodyVelocity {
  y: number;
}

export class ScenePhysicsEngine {
  private readonly velocities = new Map<string, BodyVelocity>();

  private readonly restitution = 0.53;
  private readonly restingSpeed = 38;
  private readonly maxDelta = 0.05;
  private readonly fixedStep = 1 / 60;

  step(
    objects: readonly SceneObject[],
    viewport: PhysicsViewport,
    deltaSeconds: number,
  ): PhysicsStepResult {
    const positions = new Map<string, DrawPoint>();

    if (
      !Number.isFinite(viewport.width) ||
      !Number.isFinite(viewport.height) ||
      viewport.width <= 0 ||
      viewport.height <= 0 ||
      !Number.isFinite(deltaSeconds)
    ) {
      return { positions, awake: false };
    }

    const ids = new Set(objects.map((object) => object.id));

    for (const id of this.velocities.keys()) {
      if (!ids.has(id)) {
        this.velocities.delete(id);
      }
    }

    const delta = Math.max(0, Math.min(this.maxDelta, deltaSeconds));

    const steps = Math.max(1, Math.ceil(delta / this.fixedStep));

    const stepDelta = delta / steps;

    const gravity = Math.min(1400, Math.max(420, viewport.height * 1.4));

    let awake = false;

    for (const object of objects) {
      if (
        !Number.isFinite(object.center.x) ||
        !Number.isFinite(object.center.y) ||
        !Number.isFinite(object.width) ||
        !Number.isFinite(object.height) ||
        !Number.isFinite(object.rotation) ||
        object.width <= 0 ||
        object.height <= 0
      ) {
        continue;
      }

      const { halfWidth, halfHeight } = this.getHalfExtents(object);

      const horizontalExtent = Math.min(halfWidth, viewport.width / 2);

      const verticalExtent = Math.min(halfHeight, viewport.height / 2);

      const minX = horizontalExtent;
      const maxX = viewport.width - horizontalExtent;

      const minY = verticalExtent;
      const maxY = viewport.height - verticalExtent;

      let x = Math.max(minX, Math.min(maxX, object.center.x));

      let y = Math.max(minY, Math.min(maxY, object.center.y));

      const body = this.velocities.get(object.id) ?? {
        y: 0,
      };

      let velocityY = body.y;

      for (let i = 0; i < steps; i++) {
        if (y >= maxY - 0.1 && Math.abs(velocityY) < 0.01) {
          y = maxY;
          velocityY = 0;
          break;
        }

        velocityY += gravity * stepDelta;
        y += velocityY * stepDelta;

        if (y >= maxY) {
          y = maxY;

          velocityY = velocityY > this.restingSpeed ? -velocityY * this.restitution : 0;
        }

        if (y <= minY) {
          y = minY;
          velocityY = Math.max(0, velocityY);
        }
      }

      this.velocities.set(object.id, {
        y: velocityY,
      });

      if (Math.abs(x - object.center.x) > 0.001 || Math.abs(y - object.center.y) > 0.001) {
        positions.set(object.id, { x, y });
      }

      if (y < maxY - 0.1 || Math.abs(velocityY) > 0.01 || Math.abs(x - object.center.x) > 0.001) {
        awake = true;
      }
    }

    return { positions, awake };
  }

  reset(): void {
    this.velocities.clear();
  }

  private getHalfExtents(object: SceneObject): { halfWidth: number; halfHeight: number } {
    if (object.kind === 'circle') {
      const radius = Math.min(object.width, object.height) / 2;

      return {
        halfWidth: radius,
        halfHeight: radius,
      };
    }

    const cos = Math.abs(Math.cos(object.rotation));
    const sin = Math.abs(Math.sin(object.rotation));

    return {
      halfWidth: (object.width * cos + object.height * sin) / 2,
      halfHeight: (object.width * sin + object.height * cos) / 2,
    };
  }
}
