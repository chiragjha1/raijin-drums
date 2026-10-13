// RAIJIN Deterministic State-Machine Hit Detection Engine
import {
  DrumPad,
  HandObservation,
  HitEvent,
  HitDetectorState,
  DetectorConfig,
  DrumType,
  Point2D
} from '../types';
import { isPointInsideDrum, getEllipticalDistance } from '../drums/drumPresets';
import { MotionEstimator } from '../tracking/MotionEstimator';

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  minDownwardVelocity: 0.28, // Responsive normalized screen units per second
  rearmCooldownMs: 75, // Minimum interval between hits on same drum (ms)
  approachThreshold: 0.15, // Distance above drum surface to trigger APPROACHING state
  hysteresisOffset: 0.04, // Extra margin required to exit drum and re-arm
  velocitySensitivity: 1.0,
  predictiveMode: false,
  predictionLeadTimeMs: 15
};

export class HitDetector {
  private config: DetectorConfig;
  private estimators: Map<string, MotionEstimator> = new Map();

  // HandId -> (DrumId -> State)
  private handDrumStates: Map<string, Map<DrumType, HitDetectorState>> = new Map();

  // DrumId -> Last hit timestamp
  private drumLastHitTimes: Map<DrumType, number> = new Map();

  // HandId -> Last hit timestamp
  private handLastHitTimes: Map<string, number> = new Map();

  // HandId -> Previous strike point
  private previousStrikePoints: Map<string, Point2D> = new Map();

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = { ...DEFAULT_DETECTOR_CONFIG, ...config };
  }

  public setConfig(newConfig: Partial<DetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): DetectorConfig {
    return { ...this.config };
  }

  public reset(): void {
    this.estimators.clear();
    this.handDrumStates.clear();
    this.drumLastHitTimes.clear();
    this.handLastHitTimes.clear();
    this.previousStrikePoints.clear();
  }

  /**
   * Process a list of hand observations and drum surfaces, emitting valid HitEvents.
   * Hits trigger on the exact frame the strike criteria are satisfied.
   */
  public process(
    observations: HandObservation[],
    drums: DrumPad[],
    timestamp: number
  ): HitEvent[] {
    const hitEvents: HitEvent[] = [];

    // Clean up estimators for hands that are no longer detected
    const activeHandIds = new Set(observations.map((o) => o.id));
    for (const handId of this.estimators.keys()) {
      if (!activeHandIds.has(handId)) {
        this.estimators.delete(handId);
        this.handDrumStates.delete(handId);
        this.previousStrikePoints.delete(handId);
      }
    }

    for (const obs of observations) {
      let estimator = this.estimators.get(obs.id);
      if (!estimator) {
        estimator = new MotionEstimator();
        this.estimators.set(obs.id, estimator);
      }

      const motion = estimator.update(obs.strikePoint, timestamp);
      const prevPoint = this.previousStrikePoints.get(obs.id);

      let handStates = this.handDrumStates.get(obs.id);
      if (!handStates) {
        handStates = new Map<DrumType, HitDetectorState>();
        this.handDrumStates.set(obs.id, handStates);
      }

      // Check contact points (primary strike point, index fingertip, middle fingertip)
      const candidatePoints: Point2D[] = [obs.strikePoint];
      if (obs.landmarks && obs.landmarks.indexTip) {
        candidatePoints.push({ x: obs.landmarks.indexTip.x, y: obs.landmarks.indexTip.y });
      }
      if (obs.landmarks && obs.landmarks.middleTip) {
        candidatePoints.push({ x: obs.landmarks.middleTip.x, y: obs.landmarks.middleTip.y });
      }

      for (const drum of drums) {
        const currentState = handStates.get(drum.id) || 'IDLE';

        // Check if any candidate fingertip/strike point is inside drum
        let insideNow = false;
        let minCandidateDist = Infinity;
        for (const pt of candidatePoints) {
          const d = getEllipticalDistance(pt, drum);
          if (d < minCandidateDist) minCandidateDist = d;
          if (d <= 1.0) {
            insideNow = true;
          }
        }

        const insideHysteresis = isPointInsideDrum(obs.strikePoint, drum, this.config.hysteresisOffset);

        // Predictive collision calculation
        let predictedInside = false;
        if (this.config.predictiveMode && motion.velocity.y > 0) {
          const leadSec = this.config.predictionLeadTimeMs / 1000.0;
          const predictedPoint = {
            x: obs.strikePoint.x + motion.velocity.x * leadSec,
            y: obs.strikePoint.y + motion.velocity.y * leadSec
          };
          predictedInside = getEllipticalDistance(predictedPoint, drum) <= 1.0;
        }

        // Surface crossing detection (prevents tunneling through drum in fast strikes)
        let crossedSurface = false;
        if (prevPoint) {
          const drumTopY = drum.y - drum.radiusY;
          const drumBottomY = drum.y + drum.radiusY;
          const wasAbove = prevPoint.y < drumTopY + drum.radiusY * 0.4;
          const isNowInsideOrBelow = obs.strikePoint.y >= drumTopY;
          const withinXBounds =
            Math.abs(obs.strikePoint.x - drum.x) <= drum.radiusX * 1.15 ||
            Math.abs(prevPoint.x - drum.x) <= drum.radiusX * 1.15;
          const movedDown = obs.strikePoint.y > prevPoint.y + 0.005;

          if (wasAbove && isNowInsideOrBelow && withinXBounds && movedDown && obs.strikePoint.y <= drumBottomY + 0.1) {
            crossedSurface = true;
          }
        }

        const effectiveInside = insideNow || predictedInside || crossedSurface;

        // Kinematics checks:
        // dy > 0 is downward in screen coordinates
        const downwardVel = motion.velocity.y;
        const requiredDownwardVel = this.config.minDownwardVelocity / this.config.velocitySensitivity;

        // Moving downward check: must exceed required velocity threshold
        const isMovingDownward = downwardVel >= requiredDownwardVel;

        // Cooldown checks
        const lastDrumHit = this.drumLastHitTimes.get(drum.id) || 0;
        const lastHandHit = this.handLastHitTimes.get(obs.id) || 0;
        const isCooledDown =
          timestamp - lastDrumHit >= this.config.rearmCooldownMs &&
          timestamp - lastHandHit >= 40;

        const isApproaching =
          minCandidateDist <= 1.0 + this.config.approachThreshold && downwardVel > 0.1;

        let nextState = currentState;

        const triggerHit = () => {
          // Dynamic velocity mapped to 0.2 .. 1.0
          const intensity = Math.min(
            1.0,
            Math.max(0.25, Math.abs(downwardVel) / 1.6)
          );

          hitEvents.push({
            drumId: drum.id,
            handId: obs.id,
            handedness: obs.handedness,
            timestamp,
            strikePoint: { ...obs.strikePoint },
            velocity: intensity,
            rawDownwardVelocity: downwardVel,
            predicted: !insideNow && predictedInside
          });

          this.drumLastHitTimes.set(drum.id, timestamp);
          this.handLastHitTimes.set(obs.id, timestamp);
          nextState = 'REARMING';
        };

        switch (currentState) {
          case 'IDLE':
            if (effectiveInside && isMovingDownward && isCooledDown) {
              triggerHit();
            } else if (isApproaching) {
              nextState = 'APPROACHING';
            }
            break;

          case 'APPROACHING':
            if (effectiveInside && isMovingDownward && isCooledDown) {
              triggerHit();
            } else if (!isApproaching && !effectiveInside) {
              nextState = 'IDLE';
            }
            break;

          case 'HIT':
            nextState = 'REARMING';
            break;

          case 'REARMING':
            // Re-arm when hand moves upward, leaves the drum surface, or lifts above drum center
            const movingUp = downwardVel < -0.05 || (prevPoint && obs.strikePoint.y < prevPoint.y - 0.005);
            const outsideSurface = !insideHysteresis;
            const liftedAboveCenter = obs.strikePoint.y < drum.y;

            if (outsideSurface || movingUp || liftedAboveCenter) {
              if (timestamp - lastDrumHit >= this.config.rearmCooldownMs) {
                nextState = isApproaching ? 'APPROACHING' : 'IDLE';
              }
            }
            break;
        }

        handStates.set(drum.id, nextState);
      }

      this.previousStrikePoints.set(obs.id, { ...obs.strikePoint });
    }

    return hitEvents;
  }

  public getHandDrumState(handId: string, drumId: DrumType): HitDetectorState {
    const states = this.handDrumStates.get(handId);
    return (states && states.get(drumId)) || 'IDLE';
  }

  public getAllStates(): Record<string, HitDetectorState> {
    const result: Record<string, HitDetectorState> = {};
    for (const [handId, map] of this.handDrumStates.entries()) {
      for (const [drumId, state] of map.entries()) {
        result[`${handId}_${drumId}`] = state;
      }
    }
    return result;
  }
}
