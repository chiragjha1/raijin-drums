// RAIJIN Virtual Drumming Instrument Type Definitions

export interface Point2D {
  x: number; // Normalized 0..1 (screen space)
  y: number; // Normalized 0..1 (0 = top, 1 = bottom)
}

export interface Point3D extends Point2D {
  z: number; // Relative depth from wrist estimated by MediaPipe
}

export interface HandLandmarks {
  wrist: Point3D;
  indexTip: Point3D;
  middleTip: Point3D;
  ringTip: Point3D;
  pinkyTip: Point3D;
  thumbTip: Point3D;
  indexMcp: Point3D;
  raw: Point3D[]; // Full 21 landmarks
}

export type Handedness = 'Left' | 'Right';

export interface HandObservation {
  id: string; // Persistent hand identifier ('hand_left' or 'hand_right')
  handedness: Handedness;
  confidence: number;
  timestamp: number; // High-resolution performance.now()
  landmarks: HandLandmarks;
  strikePoint: Point2D; // Virtual drumming point (fingertip / strike contact point)
}

export interface MotionState {
  velocity: Point2D; // Normalized units per second (dy > 0 is downward)
  speed: number;
  acceleration: Point2D;
  smoothedStrikePoint: Point2D;
  lastTimestamp: number;
}

export type HitDetectorState = 'IDLE' | 'APPROACHING' | 'HIT' | 'REARMING';

export interface HandTrackerState {
  observation: HandObservation;
  motion: MotionState;
  detectorState: Record<string, HitDetectorState>;
  lastHitTimestamps: Record<string, number>;
  previousPositions: Array<{ point: Point2D; timestamp: number }>;
}

export type DrumType =
  | 'snare'
  | 'kick'
  | 'hihat_closed'
  | 'hihat_open'
  | 'crash'
  | 'ride'
  | 'tom_high'
  | 'tom_low';

export interface DrumPad {
  id: DrumType;
  name: string;
  label: string; // Short uppercase label for drum surface (e.g. 'SNARE', 'KICK')
  x: number; // Center X (0..1)
  y: number; // Center Y (0..1)
  radiusX: number; // Horizontal half-width (0..1)
  radiusY: number; // Vertical half-height (0..1)
  color: string;
  accentColor: string;
  volume: number; // 0..1
  soundUrl?: string;
  isCymbal?: boolean;
}

export interface HitEvent {
  drumId: DrumType;
  handId: string;
  handedness: Handedness;
  timestamp: number;
  strikePoint: Point2D;
  velocity: number; // Normalized 0..1 strike intensity
  rawDownwardVelocity: number; // Screen units/sec
  predicted?: boolean;
}

export interface DetectorConfig {
  minDownwardVelocity: number; // Normalized screen units per second
  rearmCooldownMs: number; // Min time between hits on the same drum (ms)
  approachThreshold: number; // Distance above surface to enter APPROACHING
  hysteresisOffset: number; // Extra margin for exiting drum boundary
  velocitySensitivity: number; // Sensitivity scale factor (0.5 to 2.5)
  predictiveMode: boolean; // Enable lookahead collision
  predictionLeadTimeMs: number; // Prediction lead time (ms)
}

export interface PerformanceMetrics {
  fps: number;
  cameraFps: number;
  inferenceDurationMs: number;
  inferenceP95Ms: number;
  trackingLatencyMs: number;
  totalHits: number;
  recentHitsPerSec: number;
  audioBaseLatencyMs: number;
  audioOutputLatencyMs: number;
  droppedFrames: number;
  activeHandsCount: number;
  detectorStates: Record<string, HitDetectorState>;
}

export interface CalibrationSettings {
  mirrored: boolean;
  cameraResolution: { width: number; height: number };
  activeDrumCount: number;
  kitLayout: 'standard' | 'mirrored' | 'compact';
}
