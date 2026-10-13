import { describe, it, expect } from 'vitest';
import {
  STANDARD_KIT,
  MIRRORED_KIT,
  COMPACT_KIT,
  getEllipticalDistance,
  isPointInsideDrum
} from '../drums/drumPresets';

describe('Drum Presets & Geometry', () => {
  it('defines 8 standard drums with valid properties', () => {
    expect(STANDARD_KIT.length).toBe(8);
    for (const drum of STANDARD_KIT) {
      expect(drum.x).toBeGreaterThan(0);
      expect(drum.x).toBeLessThan(1);
      expect(drum.y).toBeGreaterThan(0);
      expect(drum.y).toBeLessThan(1);
      expect(drum.radiusX).toBeGreaterThan(0);
      expect(drum.radiusY).toBeGreaterThan(0);
      expect(drum.label).toBeTruthy();
    }
  });

  it('mirrored kit reverses horizontal positions for left-handed play', () => {
    expect(MIRRORED_KIT.length).toBe(STANDARD_KIT.length);
    for (let i = 0; i < STANDARD_KIT.length; i++) {
      expect(MIRRORED_KIT[i].x).toBeCloseTo(1.0 - STANDARD_KIT[i].x);
      expect(MIRRORED_KIT[i].y).toBeCloseTo(STANDARD_KIT[i].y);
    }
  });

  it('compact kit pulls coordinates closer to center', () => {
    const stdSnare = STANDARD_KIT.find((d) => d.id === 'snare')!;
    const compactSnare = COMPACT_KIT.find((d) => d.id === 'snare')!;
    expect(Math.abs(compactSnare.x - 0.5)).toBeLessThan(Math.abs(stdSnare.x - 0.5));
  });

  it('correctly determines whether a point is inside the drum ellipse', () => {
    const snare = STANDARD_KIT.find((d) => d.id === 'snare')!;

    // Center point
    expect(getEllipticalDistance({ x: snare.x, y: snare.y }, snare)).toBe(0);
    expect(isPointInsideDrum({ x: snare.x, y: snare.y }, snare)).toBe(true);

    // Far outside point
    expect(isPointInsideDrum({ x: 0.05, y: 0.05 }, snare)).toBe(false);

    // Border point
    const edgePoint = { x: snare.x + snare.radiusX, y: snare.y };
    expect(getEllipticalDistance(edgePoint, snare)).toBeCloseTo(1.0);
    expect(isPointInsideDrum(edgePoint, snare)).toBe(true);
  });
});
