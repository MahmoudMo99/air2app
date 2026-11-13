import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DrawPoint, GestureFrame } from './drawing.models';
import { distance } from './geometry.utils';

export class PinchGesture {
  private readonly startRatio = 0.28;
  private readonly endRatio = 0.45;
  private readonly graceMs = 180;
  private readonly requiredFrames = 3;

  private candidateFrames = 0;
  private lastConfirmedAt = 0;
  private active = false;

  update(hand: NormalizedLandmark[] | undefined, now: number): GestureFrame {
    if (!Number.isFinite(now)) {
      const action = this.active ? 'end' : 'idle';

      this.reset();

      return {
        active: false,
        action,
        cursor: null,
      };
    }

    if (!this.hasValidLandmarks(hand)) {
      this.candidateFrames = 0;
      return this.loseTracking(now);
    }

    const index = hand[8];
    const thumb = hand[4];

    const scale = Math.max(distance(hand[0], hand[9]), distance(hand[5], hand[17]), 0.01);

    const ratio = distance(index, thumb) / scale;

    const center: DrawPoint = {
      x: (index.x + thumb.x) / 2,
      y: (index.y + thumb.y) / 2,
    };

    if (!this.active) {
      this.candidateFrames = ratio <= this.startRatio ? this.candidateFrames + 1 : 0;

      if (this.candidateFrames < this.requiredFrames) {
        return {
          active: false,
          action: 'idle',
          cursor: index,
        };
      }

      this.active = true;
      this.candidateFrames = 0;
      this.lastConfirmedAt = now;

      return {
        active: true,
        action: 'start',
        cursor: center,
      };
    }

    if (ratio <= this.endRatio) {
      this.lastConfirmedAt = now;

      return {
        active: true,
        action: 'draw',
        cursor: center,
      };
    }

    if (now - this.lastConfirmedAt < this.graceMs) {
      return {
        active: true,
        action: 'pause',
        cursor: center,
      };
    }

    this.reset();

    return {
      active: false,
      action: 'end',
      cursor: index,
    };
  }

  reset(): void {
    this.active = false;
    this.candidateFrames = 0;
    this.lastConfirmedAt = 0;
  }

  private hasValidLandmarks(hand: NormalizedLandmark[] | undefined): hand is NormalizedLandmark[] {
    if (!hand || hand.length < 21) {
      return false;
    }

    const required = [0, 4, 5, 8, 9, 17];

    return required.every((index) => {
      const point = hand[index];

      return point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y);
    });
  }

  private loseTracking(now: number): GestureFrame {
    if (this.active && now - this.lastConfirmedAt < this.graceMs) {
      return {
        active: true,
        action: 'pause',
        cursor: null,
      };
    }

    const action = this.active ? 'end' : 'idle';

    this.reset();

    return {
      active: false,
      action,
      cursor: null,
    };
  }
}
