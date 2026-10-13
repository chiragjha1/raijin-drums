// RAIJIN Performance Diagnostics and Metrics Engine
import { PerformanceMetrics, HitDetectorState } from '../types';

export class PerformanceTracker {
  private frameTimestamps: number[] = [];
  private inferenceDurations: number[] = [];
  private readonly maxWindow = 60; // 60 frame rolling window

  private totalHits = 0;
  private hitTimestamps: number[] = [];
  private droppedFrames = 0;
  private cameraFrameCount = 0;
  private lastCameraFpsCalcTime = 0;
  private cameraFps = 0;

  public recordFrame(timestamp: number): void {
    this.frameTimestamps.push(timestamp);
    if (this.frameTimestamps.length > this.maxWindow) {
      this.frameTimestamps.shift();
    }
  }

  public recordInference(durationMs: number): void {
    this.inferenceDurations.push(durationMs);
    if (this.inferenceDurations.length > this.maxWindow) {
      this.inferenceDurations.shift();
    }
  }

  public recordDroppedFrame(): void {
    this.droppedFrames++;
  }

  public recordHit(timestamp: number): void {
    this.totalHits++;
    this.hitTimestamps.push(timestamp);
    // keep hits within last 5 seconds
    const threshold = timestamp - 5000;
    while (this.hitTimestamps.length > 0 && this.hitTimestamps[0] < threshold) {
      this.hitTimestamps.shift();
    }
  }

  public recordCameraFrame(timestamp: number): void {
    this.cameraFrameCount++;
    if (this.lastCameraFpsCalcTime === 0) {
      this.lastCameraFpsCalcTime = timestamp;
    } else if (timestamp - this.lastCameraFpsCalcTime >= 1000) {
      const elapsedSec = (timestamp - this.lastCameraFpsCalcTime) / 1000;
      this.cameraFps = Math.round((this.cameraFrameCount / elapsedSec) * 10) / 10;
      this.cameraFrameCount = 0;
      this.lastCameraFpsCalcTime = timestamp;
    }
  }

  public getMetrics(
    audioBaseLatencyMs: number,
    audioOutputLatencyMs: number,
    activeHandsCount: number,
    detectorStates: Record<string, HitDetectorState>
  ): PerformanceMetrics {
    // Calculate current FPS from rolling window
    let fps = 0;
    if (this.frameTimestamps.length >= 2) {
      const elapsedMs =
        this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
      if (elapsedMs > 0) {
        fps = Math.round(((this.frameTimestamps.length - 1) / (elapsedMs / 1000)) * 10) / 10;
      }
    }

    // Inference average & P95
    let inferenceAvg = 0;
    let inferenceP95 = 0;
    if (this.inferenceDurations.length > 0) {
      const sorted = [...this.inferenceDurations].sort((a, b) => a - b);
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      inferenceAvg = Math.round((sum / sorted.length) * 10) / 10;

      const p95Index = Math.min(
        sorted.length - 1,
        Math.floor(sorted.length * 0.95)
      );
      inferenceP95 = Math.round(sorted[p95Index] * 10) / 10;
    }

    // Recent hits per second
    const recentHitsPerSec =
      Math.round((this.hitTimestamps.length / 5.0) * 10) / 10;

    return {
      fps,
      cameraFps: this.cameraFps || fps,
      inferenceDurationMs: inferenceAvg,
      inferenceP95Ms: inferenceP95,
      trackingLatencyMs: Math.round((inferenceAvg + 3.0) * 10) / 10,
      totalHits: this.totalHits,
      recentHitsPerSec,
      audioBaseLatencyMs,
      audioOutputLatencyMs,
      droppedFrames: this.droppedFrames,
      activeHandsCount,
      detectorStates
    };
  }
}

export const performanceTracker = new PerformanceTracker();
