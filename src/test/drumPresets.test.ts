import { describe, it, expect } from 'vitest';
import {
  STANDARD_KIT,
  MIRRORED_KIT,
  COMPACT_KIT,
  TABLETOP_KIT,
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

  it('tabletop kit organizes pads into distinct left and right wings', () => {
    // Left wing pads should have x < 0.45
    const leftWingPads = ['snare', 'hihat_closed', 'hihat_open', 'crash'];
    // Right wing pads should have x > 0.55
    const rightWingPads = ['tom_high', 'tom_low', 'ride'];

    for (const id of leftWingPads) {
      const drum = TABLETOP_KIT.find((d) => d.id === id)!;
      expect(drum.x).toBeLessThan(0.45);
    }

    for (const id of rightWingPads) {
      const drum = TABLETOP_KIT.find((d) => d.id === id)!;
      expect(drum.x).toBeGreaterThan(0.55);
    }

    // Kick should be centered
    const kick = TABLETOP_KIT.find((d) => d.id === 'kick')!;
    expect(kick.x).toBeCloseTo(0.50);
  });
});
