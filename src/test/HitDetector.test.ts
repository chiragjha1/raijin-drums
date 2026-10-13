import { describe, it, expect, beforeEach } from 'vitest';
import { HitDetector } from '../engine/HitDetector';
import { STANDARD_KIT } from '../drums/drumPresets';
import { HandObservation } from '../types';

describe('HitDetector Engine', () => {
  let detector: HitDetector;
  const snare = STANDARD_KIT.find((d) => d.id === 'snare')!;

  const createObservation = (
    id: string,
    handedness: 'Left' | 'Right',
    x: number,
    y: number,
    timestamp: number
  ): HandObservation => {
    const pt = { x, y, z: 0 };
    return {
      id,
      handedness,
      confidence: 0.95,
      timestamp,
      strikePoint: { x, y },
      landmarks: {
        wrist: pt,
        indexTip: pt,
        middleTip: pt,
        ringTip: pt,
        pinkyTip: pt,
        thumbTip: pt,
        indexMcp: pt,
        raw: Array(21).fill(pt)
      }
    };
  };

  beforeEach(() => {
    detector = new HitDetector({
      minDownwardVelocity: 0.6,
      rearmCooldownMs: 80,
      velocitySensitivity: 1.0
    });
  });

  it('triggers a hit on decisive downward strike', () => {
    // 1. Hand starts above snare (y = 0.40) at t = 100ms
    const obs1 = createObservation('right_hand', 'Right', snare.x, snare.y - 0.25, 100);
    const hits1 = detector.process([obs1], [snare], 100);
    expect(hits1.length).toBe(0);

    // 2. Hand moves swiftly downwards towards snare surface (y = snare.y) at t = 150ms
    // dy = 0.25 in 50ms -> velocity ~ 5.0 unit/s
    const obs2 = createObservation('right_hand', 'Right', snare.x, snare.y, 150);
    const hits2 = detector.process([obs2], [snare], 150);

    expect(hits2.length).toBe(1);
    expect(hits2[0].drumId).toBe('snare');
    expect(hits2[0].handId).toBe('right_hand');
    expect(hits2[0].velocity).toBeGreaterThan(0.2);
  });

  it('does NOT trigger repeatedly while hand remains stationary inside the drum', () => {
    // Approach & strike
    detector.process([createObservation('right_hand', 'Right', snare.x, snare.y - 0.25, 100)], [snare], 100);
    const strikeHits = detector.process(
      [createObservation('right_hand', 'Right', snare.x, snare.y, 150)],
      [snare],
      150
    );
    expect(strikeHits.length).toBe(1);

    // Hand stays at same position in subsequent frames
    const frame2Hits = detector.process(
      [createObservation('right_hand', 'Right', snare.x, snare.y, 180)],
      [snare],
      180
    );
    const frame3Hits = detector.process(
      [createObservation('right_hand', 'Right', snare.x, snare.y, 220)],
      [snare],
      220
    );

    expect(frame2Hits.length).toBe(0);
    expect(frame3Hits.length).toBe(0);
  });

  it('rejects upward motion through a drum', () => {
    // Hand starts below snare and moves up
    detector.process([createObservation('right_hand', 'Right', snare.x, snare.y + 0.15, 100)], [snare], 100);
    const hits = detector.process([createObservation('right_hand', 'Right', snare.x, snare.y, 150)], [snare], 150);

    expect(hits.length).toBe(0);
  });

  it('rejects purely horizontal gestures', () => {
    // Hand sweeps horizontally across drum at constant y
    detector.process([createObservation('right_hand', 'Right', snare.x - 0.2, snare.y, 100)], [snare], 100);
    const hits = detector.process([createObservation('right_hand', 'Right', snare.x, snare.y, 140)], [snare], 140);

    expect(hits.length).toBe(0);
  });

  it('rejects slow hovering motion below downward velocity threshold', () => {
    // Very slow drift: dy = 0.01 over 200ms -> vel ~ 0.05
    detector.process([createObservation('right_hand', 'Right', snare.x, snare.y - 0.05, 100)], [snare], 100);
    const hits = detector.process([createObservation('right_hand', 'Right', snare.x, snare.y, 300)], [snare], 300);

    expect(hits.length).toBe(0);
  });

  it('supports two hands striking simultaneously', () => {
    const kick = STANDARD_KIT.find((d) => d.id === 'kick')!;

    // Initial position for both hands
    const left1 = createObservation('left_hand', 'Left', snare.x, snare.y - 0.25, 100);
    const right1 = createObservation('right_hand', 'Right', kick.x, kick.y - 0.25, 100);
    detector.process([left1, right1], [snare, kick], 100);

    // Simultaneous downward strike
    const left2 = createObservation('left_hand', 'Left', snare.x, snare.y, 150);
    const right2 = createObservation('right_hand', 'Right', kick.x, kick.y, 150);
    const simultaneousHits = detector.process([left2, right2], [snare, kick], 150);

    expect(simultaneousHits.length).toBe(2);
    const drumIds = simultaneousHits.map((h) => h.drumId);
    expect(drumIds).toContain('snare');
    expect(drumIds).toContain('kick');
  });

  it('re-arms correctly after hand retracts above drum', () => {
    // 1st strike
    detector.process([createObservation('hand', 'Right', snare.x, snare.y - 0.25, 100)], [snare], 100);
    const hit1 = detector.process([createObservation('hand', 'Right', snare.x, snare.y, 150)], [snare], 150);
    expect(hit1.length).toBe(1);

    // Hand pulls back up out of drum
    detector.process([createObservation('hand', 'Right', snare.x, snare.y - 0.25, 260)], [snare], 260);

    // 2nd strike
    const hit2 = detector.process([createObservation('hand', 'Right', snare.x, snare.y, 310)], [snare], 310);
    expect(hit2.length).toBe(1);
  });
});
