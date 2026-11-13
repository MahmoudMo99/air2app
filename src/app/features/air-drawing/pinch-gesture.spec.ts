import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import { PinchGesture } from './pinch-gesture';

describe('PinchGesture', () => {
  function createHand(ratio: number): NormalizedLandmark[] {
    const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

    points[0] = { x: 0.3, y: 0.5, z: 0 };
    points[9] = { x: 0.3, y: 0.7, z: 0 };

    points[5] = { x: 0.4, y: 0.4, z: 0 };
    points[17] = { x: 0.6, y: 0.4, z: 0 };

    points[8] = { x: 0.5, y: 0.5, z: 0 };
    points[4] = {
      x: 0.5 + ratio * 0.2,
      y: 0.5,
      z: 0,
    };

    return points as NormalizedLandmark[];
  }

  function startPinch(gesture: PinchGesture): void {
    gesture.update(createHand(0.2), 0);
    gesture.update(createHand(0.2), 16);
    gesture.update(createHand(0.2), 32);
  }

  it('requires three confirmed frames to start', () => {
    const gesture = new PinchGesture();

    const first = gesture.update(createHand(0.2), 0);
    const second = gesture.update(createHand(0.2), 16);
    const third = gesture.update(createHand(0.2), 32);

    expect(first.action).toBe('idle');
    expect(second.action).toBe('idle');
    expect(third.action).toBe('start');
    expect(third.active).toBe(true);
  });

  it('does not start while fingers are apart', () => {
    const gesture = new PinchGesture();

    for (let i = 0; i < 6; i++) {
      const frame = gesture.update(createHand(0.6), i * 16);

      expect(frame.active).toBe(false);
      expect(frame.action).toBe('idle');
    }
  });

  it('uses hysteresis to keep an active pinch stable', () => {
    const gesture = new PinchGesture();

    startPinch(gesture);

    const frame = gesture.update(createHand(0.4), 48);

    expect(frame.active).toBe(true);
    expect(frame.action).toBe('draw');

    const paused = gesture.update(createHand(0.6), 64);

    expect(paused.active).toBe(true);
    expect(paused.action).toBe('pause');

    const ended = gesture.update(createHand(0.6), 240);

    expect(ended.active).toBe(false);
    expect(ended.action).toBe('end');
  });

  it('pauses briefly when the hand disappears', () => {
    const gesture = new PinchGesture();

    startPinch(gesture);

    const paused = gesture.update(undefined, 80);

    expect(paused.active).toBe(true);
    expect(paused.action).toBe('pause');
    expect(paused.cursor).toBeNull();
  });

  it('resumes the same pinch after temporary tracking loss', () => {
    const gesture = new PinchGesture();

    startPinch(gesture);

    gesture.update(undefined, 80);

    const resumed = gesture.update(createHand(0.2), 120);

    expect(resumed.active).toBe(true);
    expect(resumed.action).toBe('draw');
    expect(resumed.cursor).not.toBeNull();
  });

  it('ends a pinch after the tracking grace period', () => {
    const gesture = new PinchGesture();

    startPinch(gesture);

    const ended = gesture.update(undefined, 220);

    expect(ended.active).toBe(false);
    expect(ended.action).toBe('end');
  });

  it('handles invalid landmarks without throwing', () => {
    const gesture = new PinchGesture();

    const invalid = createHand(0.2);
    invalid[8] = {
      ...invalid[8],
      x: Number.NaN,
    };

    const idle = gesture.update(invalid, 0);

    expect(idle.action).toBe('idle');
    expect(idle.active).toBe(false);

    startPinch(gesture);

    const paused = gesture.update(invalid, 48);

    expect(paused.action).toBe('pause');
    expect(paused.active).toBe(true);
  });

  it('resets pinch confirmation after an interrupted candidate', () => {
    const gesture = new PinchGesture();

    gesture.update(createHand(0.2), 0);
    gesture.update(createHand(0.2), 16);
    gesture.update(undefined, 32);

    const frame = gesture.update(createHand(0.2), 48);

    expect(frame.action).toBe('idle');
    expect(frame.active).toBe(false);
  });

  it('returns an end event for an invalid timestamp during a pinch', () => {
    const gesture = new PinchGesture();

    startPinch(gesture);

    const frame = gesture.update(createHand(0.2), Number.NaN);

    expect(frame.action).toBe('end');
    expect(frame.active).toBe(false);
  });
});
