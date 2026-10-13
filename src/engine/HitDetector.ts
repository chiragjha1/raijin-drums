// RAIJIN Deterministic State-Machine Hit Detection Engine
import {
  DrumPad,
  HandObservation,
  HitEvent,
  HitDetectorState,
  DetectorConfig,
  DrumType
} from '../types';
import { isPointInsideDrum, getEllipticalDistance } from '../drums/drumPresets';
import { MotionEstimator } from '../tracking/MotionEstimator';

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  minDownwardVelocity: 0.65, // Normalized screen units per second
  rearmCooldownMs: 80, // Minimum interval between hits on same drum
  approachThreshold: 0.12, // Distance above drum surface to trigger APPROACHING state
  hysteresisOffset: 0.03, // Extra margin required to exit drum and re-arm
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
  }

  /**
   * Process a list of hand observations and drum surfaces, emitting valid HitEvents.
   * Zero frame delay: hits trigger on the exact frame the strike criteria are satisfied.
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
      }
    }

    for (const obs of observations) {
      let estimator = this.estimators.get(obs.id);
      if (!estimator) {
        estimator = new MotionEstimator();
        this.estimators.set(obs.id, estimator);
      }

      const motion = estimator.update(obs.strikePoint, timestamp);

      let handStates = this.handDrumStates.get(obs.id);
      if (!handStates) {
        handStates = new Map<DrumType, HitDetectorState>();
        this.handDrumStates.set(obs.id, handStates);
      }

      for (const drum of drums) {
        const currentState = handStates.get(drum.id) || 'IDLE';

        // Evaluate distance and geometric collision
        const dist = getEllipticalDistance(obs.strikePoint, drum);
        const insideNow = dist <= 1.0;
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

        const effectiveInside = insideNow || predictedInside;

        // Kinematics checks:
        // dy > 0 is downward
        const downwardVel = motion.velocity.y;
        const horizontalVel = Math.abs(motion.velocity.x);

        // Effective threshold scaled by user sensitivity
        const requiredDownwardVel = this.config.minDownwardVelocity / this.config.velocitySensitivity;

        const isMovingDownward = downwardVel >= requiredDownwardVel;
        const isNotPredominantlyHorizontal = downwardVel > horizontalVel * 0.45;
        const isApproaching =
          dist <= 1.0 + this.config.approachThreshold && downwardVel > 0.2;

        const lastDrumHit = this.drumLastHitTimes.get(drum.id) || 0;
        const lastHandHit = this.handLastHitTimes.get(obs.id) || 0;
        const isCooledDown =
          timestamp - lastDrumHit >= this.config.rearmCooldownMs &&
          timestamp - lastHandHit >= 45; // Minimum interval between any hits by same hand

        let nextState = currentState;

        const triggerHit = () => {
          const intensity = Math.min(
            1.0,
            Math.max(0.2, (downwardVel - requiredDownwardVel * 0.5) / 1.5)
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
            if (effectiveInside && isMovingDownward && isNotPredominantlyHorizontal && isCooledDown) {
              triggerHit();
            } else if (isApproaching) {
              nextState = 'APPROACHING';
            }
            break;

          case 'APPROACHING':
            if (effectiveInside && isMovingDownward && isNotPredominantlyHorizontal && isCooledDown) {
              triggerHit();
            } else if (!isApproaching && !effectiveInside) {
              nextState = 'IDLE';
            }
            break;

          case 'HIT':
            // Immediate transition into rearming if hit was already emitted
            nextState = 'REARMING';
            break;

          case 'REARMING':
            // Only re-arm once hand exits the hysteresis boundary OR is rebounding upward
            if (!insideHysteresis || downwardVel < -0.1) {
              if (timestamp - lastDrumHit >= this.config.rearmCooldownMs) {
                nextState = isApproaching ? 'APPROACHING' : 'IDLE';
              }
            }
            break;
        }

        handStates.set(drum.id, nextState);
      }
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
