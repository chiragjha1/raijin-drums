// RAIJIN Virtual Drum Kit Layout Presets and Collision Geometry
import { DrumPad, Point2D } from '../types';

export const STANDARD_KIT: DrumPad[] = [
  {
    id: 'snare',
    name: 'Snare Drum',
    japaneseName: '小太鼓',
    x: 0.40,
    y: 0.68,
    radiusX: 0.11,
    radiusY: 0.10,
    color: '#ffffff',
    accentColor: '#d32f2f', // Vermilion / Cinnabar
    volume: 0.9,
    isCymbal: false
  },
  {
    id: 'kick',
    name: 'Bass Drum (Kick)',
    japaneseName: '大太鼓',
    x: 0.50,
    y: 0.88,
    radiusX: 0.13,
    radiusY: 0.09,
    color: '#ffffff',
    accentColor: '#1e293b', // Deep Sumi Slate
    volume: 0.95,
    isCymbal: false
  },
  {
    id: 'hihat_closed',
    name: 'Closed Hi-Hat',
    japaneseName: '閉ハイハット',
    x: 0.18,
    y: 0.64,
    radiusX: 0.09,
    radiusY: 0.08,
    color: '#ffffff',
    accentColor: '#c29d38', // Burnished Brass
    volume: 0.85,
    isCymbal: true
  },
  {
    id: 'hihat_open',
    name: 'Open Hi-Hat',
    japaneseName: '開ハイハット',
    x: 0.16,
    y: 0.48,
    radiusX: 0.09,
    radiusY: 0.08,
    color: '#ffffff',
    accentColor: '#d4af37', // Gold
    volume: 0.85,
    isCymbal: true
  },
  {
    id: 'crash',
    name: 'Crash Cymbal',
    japaneseName: 'クラッシュ',
    x: 0.22,
    y: 0.28,
    radiusX: 0.12,
    radiusY: 0.08,
    color: '#ffffff',
    accentColor: '#eab308',
    volume: 0.9,
    isCymbal: true
  },
  {
    id: 'ride',
    name: 'Ride Cymbal',
    japaneseName: 'ライド',
    x: 0.80,
    y: 0.32,
    radiusX: 0.13,
    radiusY: 0.08,
    color: '#ffffff',
    accentColor: '#ca8a04',
    volume: 0.9,
    isCymbal: true
  },
  {
    id: 'tom_high',
    name: 'High Tom',
    japaneseName: '高タム',
    x: 0.38,
    y: 0.44,
    radiusX: 0.10,
    radiusY: 0.09,
    color: '#ffffff',
    accentColor: '#0284c7', // Indigo
    volume: 0.85,
    isCymbal: false
  },
  {
    id: 'tom_low',
    name: 'Low Tom (Floor)',
    japaneseName: '低タム',
    x: 0.65,
    y: 0.58,
    radiusX: 0.11,
    radiusY: 0.10,
    color: '#ffffff',
    accentColor: '#4f46e5', // Deep Violet
    volume: 0.9,
    isCymbal: false
  }
];

export const MIRRORED_KIT: DrumPad[] = STANDARD_KIT.map((drum) => ({
  ...drum,
  x: 1.0 - drum.x
}));

export const COMPACT_KIT: DrumPad[] = STANDARD_KIT.map((drum) => ({
  ...drum,
  // Bring positions closer towards center
  x: 0.5 + (drum.x - 0.5) * 0.75,
  y: 0.5 + (drum.y - 0.5) * 0.8,
  radiusX: drum.radiusX * 0.9,
  radiusY: drum.radiusY * 0.9
}));

/**
 * Calculates normalized elliptical distance from point to drum center.
 * If <= 1.0, the point is inside the drum surface.
 */
export function getEllipticalDistance(point: Point2D, drum: DrumPad): number {
  const dx = (point.x - drum.x) / drum.radiusX;
  const dy = (point.y - drum.y) / drum.radiusY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks if a 2D point is currently within the drum surface boundary.
 */
export function isPointInsideDrum(point: Point2D, drum: DrumPad, margin = 0): boolean {
  const rx = drum.radiusX + margin;
  const ry = drum.radiusY + margin;
  const dx = (point.x - drum.x) / rx;
  const dy = (point.y - drum.y) / ry;
  return dx * dx + dy * dy <= 1.0;
}
