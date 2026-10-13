import { describe, it, expect, beforeEach } from 'vitest';
import { HitDetector } from '../engine/HitDetector';
import { STANDARD_KIT, MIRRORED_KIT, COMPACT_KIT } from '../drums/drumPresets';
import { HandObservation } from '../types';

describe('Integration Pipeline', () => {
  let detector: HitDetector;

  beforeEach(() => {
    detector = new HitDetector();
  });

  it('coordinates full end-to-end multi-drum playback sequence', () => {
    const hitsReceived: string[] = [];

    // Mock AudioContext and buffer generation for Node/JSDOM test runner
    const mockAudioEngine = {
      trigger: (drumId: string) => {
        hitsReceived.push(drumId);
      }
    };

    const snare = STANDARD_KIT.find((d) => d.id === 'snare')!;
    const crash = STANDARD_KIT.find((d) => d.id === 'crash')!;

    // 1. Strike snare
    const obsSnare1: HandObservation = {
      id: 'right_hand',
      handedness: 'Right',
      confidence: 0.9,
      timestamp: 100,
      strikePoint: { x: snare.x, y: snare.y - 0.2 },
      landmarks: {
        wrist: { x: snare.x, y: snare.y, z: 0 },
        indexTip: { x: snare.x, y: snare.y, z: 0 },
        middleTip: { x: snare.x, y: snare.y, z: 0 },
        ringTip: { x: snare.x, y: snare.y, z: 0 },
        pinkyTip: { x: snare.x, y: snare.y, z: 0 },
        thumbTip: { x: snare.x, y: snare.y, z: 0 },
        indexMcp: { x: snare.x, y: snare.y, z: 0 },
        raw: []
      }
    };

    detector.process([obsSnare1], STANDARD_KIT, 100);

    const obsSnare2: HandObservation = {
      ...obsSnare1,
      timestamp: 140,
      strikePoint: { x: snare.x, y: snare.y }
    };

    const hits1 = detector.process([obsSnare2], STANDARD_KIT, 140);
    hits1.forEach((h) => mockAudioEngine.trigger(h.drumId));

    expect(hitsReceived).toEqual(['snare']);

    // 2. Strike crash cymbal with other hand
    const crashPt = { x: crash.x, y: crash.y, z: 0 };
    const obsCrash1: HandObservation = {
      id: 'left_hand',
      handedness: 'Left',
      confidence: 0.9,
      timestamp: 250,
      strikePoint: { x: crash.x, y: crash.y - 0.2 },
      landmarks: {
        wrist: crashPt,
        indexTip: { x: crash.x, y: crash.y - 0.2, z: 0 },
        middleTip: { x: crash.x, y: crash.y - 0.2, z: 0 },
        ringTip: crashPt,
        pinkyTip: crashPt,
        thumbTip: crashPt,
        indexMcp: crashPt,
        raw: []
      }
    };
    detector.process([obsCrash1], STANDARD_KIT, 250);

    const obsCrash2: HandObservation = {
      ...obsCrash1,
      timestamp: 290,
      strikePoint: { x: crash.x, y: crash.y },
      landmarks: {
        ...obsCrash1.landmarks,
        indexTip: crashPt,
        middleTip: crashPt
      }
    };
    const hits2 = detector.process([obsCrash2], STANDARD_KIT, 290);
    hits2.forEach((h) => mockAudioEngine.trigger(h.drumId));

    expect(hitsReceived).toEqual(['snare', 'crash']);
  });

  it('handles seamless layout hot-swapping', () => {
    // When switching from standard to mirrored, kit geometry shifts across x-axis
    expect(STANDARD_KIT[0].x).not.toEqual(MIRRORED_KIT[0].x);
    expect(STANDARD_KIT[0].x).toBeCloseTo(1.0 - MIRRORED_KIT[0].x);

    // Compact kit has smaller radii and condensed coordinates
    expect(COMPACT_KIT[0].radiusX).toBeLessThan(STANDARD_KIT[0].radiusX);
  });
});
