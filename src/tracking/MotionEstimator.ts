// RAIJIN Motion Estimator with Timestamp-Aware Velocity and Filtering
import { Point2D, MotionState } from '../types';

export interface PositionSample {
  point: Point2D;
  timestamp: number;
}

export class MotionEstimator {
  private history: PositionSample[] = [];
  private readonly maxHistory = 8;
  private readonly maxTrackingGapMs = 250; // Reset history if gap is longer than 250ms

  // Alpha filter coefficient: balance between latency and landmark jitter
  // 0.7 gives responsive tracking while smoothing out single-frame subpixel noise
  private readonly alpha = 0.72;

  private smoothedPoint: Point2D | null = null;
  private currentVelocity: Point2D = { x: 0, y: 0 };
  private previousVelocity: Point2D = { x: 0, y: 0 };
  private currentAcceleration: Point2D = { x: 0, y: 0 };
  private lastUpdateTimestamp = 0;

  public reset(): void {
    this.history = [];
    this.smoothedPoint = null;
    this.currentVelocity = { x: 0, y: 0 };
    this.previousVelocity = { x: 0, y: 0 };
    this.currentAcceleration = { x: 0, y: 0 };
    this.lastUpdateTimestamp = 0;
  }

  /**
   * Updates tracking history with a new observation and computes instantaneous & filtered kinematics.
   * dt is measured in seconds from actual performance timestamps.
   */
  public update(point: Point2D, timestamp: number): MotionState {
    const elapsedMs = this.lastUpdateTimestamp > 0 ? timestamp - this.lastUpdateTimestamp : 0;

    // If tracking was lost or frame took too long, reset history to avoid erratic velocity spikes
    if (elapsedMs > this.maxTrackingGapMs || this.lastUpdateTimestamp === 0) {
      this.reset();
      this.smoothedPoint = { ...point };
      this.lastUpdateTimestamp = timestamp;
      this.history.push({ point: { ...point }, timestamp });
      return {
        velocity: { x: 0, y: 0 },
        speed: 0,
        acceleration: { x: 0, y: 0 },
        smoothedStrikePoint: { ...point },
        lastTimestamp: timestamp
      };
    }

    // Exponential smoothing for spatial coordinates
    if (!this.smoothedPoint) {
      this.smoothedPoint = { ...point };
    } else {
      this.smoothedPoint = {
        x: this.alpha * point.x + (1 - this.alpha) * this.smoothedPoint.x,
        y: this.alpha * point.y + (1 - this.alpha) * this.smoothedPoint.y
      };
    }

    // Add to rolling history
    this.history.push({ point: { ...point }, timestamp });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Calculate velocity using timestamps
    const dtSeconds = elapsedMs / 1000.0;
    if (dtSeconds > 0.001) {
      // Calculate instantaneous raw velocity
      const prevSample = this.history[this.history.length - 2];
      const rawVx = (point.x - prevSample.point.x) / dtSeconds;
      const rawVy = (point.y - prevSample.point.y) / dtSeconds;

      // Filter velocity to prevent camera jitter from triggering false downward strikes
      const vAlpha = 0.65;
      const vx = vAlpha * rawVx + (1 - vAlpha) * this.currentVelocity.x;
      const vy = vAlpha * rawVy + (1 - vAlpha) * this.currentVelocity.y;

      // Compute acceleration: (v - prevV) / dt
      const ax = (vx - this.currentVelocity.x) / dtSeconds;
      const ay = (vy - this.currentVelocity.y) / dtSeconds;

      this.previousVelocity = { ...this.currentVelocity };
      this.currentVelocity = { x: vx, y: vy };
      this.currentAcceleration = { x: ax, y: ay };
    }

    this.lastUpdateTimestamp = timestamp;

    const speed = Math.sqrt(
      this.currentVelocity.x * this.currentVelocity.x +
      this.currentVelocity.y * this.currentVelocity.y
    );

    return {
      velocity: { ...this.currentVelocity },
      speed,
      acceleration: { ...this.currentAcceleration },
      smoothedStrikePoint: { ...this.smoothedPoint },
      lastTimestamp: timestamp
    };
  }

  public getKinematics(): {
    velocity: Point2D;
    previousVelocity: Point2D;
    acceleration: Point2D;
    smoothedPoint: Point2D | null;
  } {
    return {
      velocity: { ...this.currentVelocity },
      previousVelocity: { ...this.previousVelocity },
      acceleration: { ...this.currentAcceleration },
      smoothedPoint: this.smoothedPoint ? { ...this.smoothedPoint } : null
    };
  }
}
