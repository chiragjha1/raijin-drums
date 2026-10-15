// RAIJIN MediaPipe Tasks Vision Hand Tracker
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandObservation, HandLandmarks, Point3D, Point2D, Handedness } from '../types';

const CDN_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const CDN_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing = false;
  private isReady = false;
  private lastVideoTime = -1;
  private lastInferenceDurationMs = 0;

  // Hand identity continuity: track last known wrist positions
  private previousHandPositions: Map<string, Point2D> = new Map();

  public getReady(): boolean {
    return this.isReady;
  }

  public getLastInferenceDuration(): number {
    return this.lastInferenceDurationMs;
  }

  /**
   * Initializes MediaPipe Hand Landmarker with CDN and local fallbacks
   */
  public async initialize(): Promise<void> {
    if (this.isReady || this.isInitializing) return;
    this.isInitializing = true;

    try {
      // Build safe absolute local path using current window location
      let localWasmUrl = '';
      let localModelUrl = '';
      try {
        const baseUrl = window.location.href.split('?')[0].split('#')[0];
        const dirUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
        localWasmUrl = new URL('wasm', dirUrl).href;
        localModelUrl = new URL('models/hand_landmarker.task', dirUrl).href;
      } catch {
        // Fallback to relative
        localWasmUrl = './wasm';
        localModelUrl = './models/hand_landmarker.task';
      }

      // 1. Resolve WASM assets: prioritize CDN on web for zero-404 reliability, fallback to local
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks(CDN_WASM_PATH);
      } catch (cdnErr) {
        console.warn('CDN WASM loading failed, falling back to local assets...', cdnErr);
        vision = await FilesetResolver.forVisionTasks(localWasmUrl);
      }

      // 2. Initialize HandLandmarker: prioritize CDN model asset, fallback to local
      const modelCandidates = [CDN_MODEL_PATH, localModelUrl];

      let landmarker: HandLandmarker | null = null;
      let lastError: Error | null = null;

      for (const modelPath of modelCandidates) {
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelPath,
              delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
          break;
        } catch (err) {
          lastError = err as Error;
          // Try CPU delegate if GPU delegate failed
          try {
            landmarker = await HandLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: modelPath,
                delegate: 'CPU'
              },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: 0.5,
              minHandPresenceConfidence: 0.5,
              minTrackingConfidence: 0.5
            });
            break;
          } catch (cpuErr) {
            lastError = cpuErr as Error;
          }
        }
      }

      if (!landmarker) {
        throw lastError || new Error('Failed to instantiate MediaPipe HandLandmarker');
      }

      this.handLandmarker = landmarker;
      this.isReady = true;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Detects hands on the current video frame.
   * Drops duplicate frames if video hasn't progressed.
   */
  public processVideoFrame(
    video: HTMLVideoElement,
    timestamp: number,
    isMirrored = true
  ): HandObservation[] {
    if (!this.handLandmarker || !this.isReady) return [];

    // Drop repeated frames if video playback has not advanced
    if (video.currentTime === this.lastVideoTime) {
      return [];
    }
    this.lastVideoTime = video.currentTime;

    const t0 = performance.now();
    const result = this.handLandmarker.detectForVideo(video, timestamp);
    this.lastInferenceDurationMs = performance.now() - t0;

    if (!result.landmarks || result.landmarks.length === 0) {
      return [];
    }

    const observations: HandObservation[] = [];

    for (let i = 0; i < result.landmarks.length; i++) {
      const rawLandmarks = result.landmarks[i];
      if (!rawLandmarks || rawLandmarks.length < 21) continue;

      // Extract reported handedness or default
      const reportedHandedness: Handedness =
        result.handedness && result.handedness[i] && result.handedness[i][0]
          ? (result.handedness[i][0].categoryName as Handedness)
          : i === 0
          ? 'Right'
          : 'Left';

      const confidence =
        result.handedness && result.handedness[i] && result.handedness[i][0]
          ? result.handedness[i][0].score
          : 0.85;

      // Map landmarks to normalized coordinates
      // When mirrored: horizontal x coordinate is mirrored (1 - x)
      const mappedRaw: Point3D[] = rawLandmarks.map((pt) => ({
        x: isMirrored ? 1.0 - pt.x : pt.x,
        y: pt.y,
        z: pt.z || 0
      }));

      const handLandmarks: HandLandmarks = {
        wrist: mappedRaw[0],
        thumbTip: mappedRaw[4],
        indexMcp: mappedRaw[5],
        indexTip: mappedRaw[8],
        middleTip: mappedRaw[12],
        ringTip: mappedRaw[16],
        pinkyTip: mappedRaw[20],
        raw: mappedRaw
      };

      // Strike point: leading fingertip (index or middle, whichever extends furthest down)
      const leadTip =
        handLandmarks.indexTip.y >= handLandmarks.middleTip.y
          ? handLandmarks.indexTip
          : handLandmarks.middleTip;

      const strikePoint: Point2D = {
        x: leadTip.x,
        y: leadTip.y
      };

      // Hand Identity Continuity:
      let persistentId = `hand_${i}`;
      const currentWrist: Point2D = { x: handLandmarks.wrist.x, y: handLandmarks.wrist.y };

      let bestDist = Infinity;
      let matchedId = '';
      for (const [prevId, prevWrist] of this.previousHandPositions.entries()) {
        const d = Math.hypot(currentWrist.x - prevWrist.x, currentWrist.y - prevWrist.y);
        if (d < bestDist && d < 0.25) {
          bestDist = d;
          matchedId = prevId;
        }
      }

      if (matchedId) {
        persistentId = matchedId;
      } else {
        // Fallback to spatial handedness if no close match
        persistentId = strikePoint.x < 0.5 ? 'hand_left' : 'hand_right';
      }

      this.previousHandPositions.set(persistentId, currentWrist);

      observations.push({
        id: persistentId,
        handedness: reportedHandedness,
        confidence,
        timestamp,
        landmarks: handLandmarks,
        strikePoint
      });
    }

    return observations;
  }

  public dispose(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
    this.previousHandPositions.clear();
    this.isReady = false;
  }
}

export const handTracker = new HandTracker();
