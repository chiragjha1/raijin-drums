import { describe, it, expect, beforeEach } from 'vitest';
import { MotionEstimator } from '../tracking/MotionEstimator';

describe('MotionEstimator', () => {
  let estimator: MotionEstimator;

  beforeEach(() => {
    estimator = new MotionEstimator();
  });

  it('initializes with zero velocity and acceleration', () => {
    const motion = estimator.update({ x: 0.5, y: 0.5 }, 1000);
    expect(motion.velocity.x).toBe(0);
    expect(motion.velocity.y).toBe(0);
    expect(motion.speed).toBe(0);
    expect(motion.smoothedStrikePoint.x).toBeCloseTo(0.5);
  });

  it('correctly calculates downward velocity using actual dt', () => {
    // Initial sample at t = 1000ms
    estimator.update({ x: 0.5, y: 0.4 }, 1000);

    // Moves down to y = 0.5 in 100ms (dy = 0.1, dt = 0.1s -> velocity ~ 1.0 unit/s)
    const motion = estimator.update({ x: 0.5, y: 0.5 }, 1100);

    // Filtered downward velocity should be positive and substantial
    expect(motion.velocity.y).toBeGreaterThan(0.5);
    expect(motion.velocity.x).toBeCloseTo(0, 1);
  });

  it('rejects jitter and resets if tracking gap exceeds threshold', () => {
    estimator.update({ x: 0.5, y: 0.4 }, 1000);
    estimator.update({ x: 0.5, y: 0.6 }, 1050);

    // Long tracking gap of 400ms (> 250ms threshold)
    const resetMotion = estimator.update({ x: 0.5, y: 0.7 }, 1450);

    // After gap, velocity should reset to 0 rather than computing an erratic spike
    expect(resetMotion.velocity.y).toBe(0);
  });

  it('applies exponential smoothing to coordinates', () => {
    estimator.update({ x: 0.2, y: 0.2 }, 1000);
    const motion = estimator.update({ x: 0.4, y: 0.4 }, 1033);

    // Smoothed point should be between previous and current
    expect(motion.smoothedStrikePoint.x).toBeGreaterThan(0.2);
    expect(motion.smoothedStrikePoint.x).toBeLessThan(0.4);
  });
});
