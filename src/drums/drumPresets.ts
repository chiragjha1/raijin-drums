// RAIJIN Virtual Drum Kit Layout Presets and Collision Geometry
import { DrumPad, Point2D } from '../types';

export const STANDARD_KIT: DrumPad[] = [
  {
    id: 'snare',
    name: 'Snare Drum',
    label: 'SNARE',
    x: 0.38,
    y: 0.67,
    radiusX: 0.12,
    radiusY: 0.11,
    color: '#ffffff',
    accentColor: '#d32f2f', // Vermilion / Red
    volume: 0.95,
    isCymbal: false
  },
  {
    id: 'kick',
    name: 'Bass Drum',
    label: 'KICK',
    x: 0.50,
    y: 0.86,
    radiusX: 0.14,
    radiusY: 0.10,
    color: '#ffffff',
    accentColor: '#1e293b', // Deep Slate
    volume: 1.0,
    isCymbal: false
  },
  {
    id: 'hihat_closed',
    name: 'Closed Hi-Hat',
    label: 'CLOSED HH',
    x: 0.18,
    y: 0.64,
    radiusX: 0.10,
    radiusY: 0.09,
    color: '#ffffff',
    accentColor: '#c29d38', // Brass
    volume: 0.85,
    isCymbal: true
  },
  {
    id: 'hihat_open',
    name: 'Open Hi-Hat',
    label: 'OPEN HH',
    x: 0.16,
    y: 0.48,
    radiusX: 0.10,
    radiusY: 0.09,
    color: '#ffffff',
    accentColor: '#d4af37', // Gold
    volume: 0.85,
    isCymbal: true
  },
  {
    id: 'crash',
    name: 'Crash Cymbal',
    label: 'CRASH',
    x: 0.22,
    y: 0.28,
    radiusX: 0.13,
    radiusY: 0.09,
    color: '#ffffff',
    accentColor: '#eab308',
    volume: 0.9,
    isCymbal: true
  },
  {
    id: 'ride',
    name: 'Ride Cymbal',
    label: 'RIDE',
    x: 0.80,
    y: 0.32,
    radiusX: 0.14,
    radiusY: 0.09,
    color: '#ffffff',
    accentColor: '#ca8a04',
    volume: 0.9,
    isCymbal: true
  },
  {
    id: 'tom_high',
    name: 'High Tom',
    label: 'HIGH TOM',
    x: 0.38,
    y: 0.44,
    radiusX: 0.11,
    radiusY: 0.10,
    color: '#ffffff',
    accentColor: '#0284c7', // Cyan / Indigo
    volume: 0.85,
    isCymbal: false
  },
  {
    id: 'tom_low',
    name: 'Low Tom',
    label: 'LOW TOM',
    x: 0.64,
    y: 0.58,
    radiusX: 0.12,
    radiusY: 0.11,
    color: '#ffffff',
    accentColor: '#4f46e5', // Indigo
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
  radiusX: drum.radiusX * 0.95,
  radiusY: drum.radiusY * 0.95
}));

export const TABLETOP_KIT: DrumPad[] = [
  // Left Hand Zone
  {
    id: 'crash',
    name: 'Crash Cymbal',
    label: 'CRASH',
    x: 0.14,
    y: 0.28,
    radiusX: 0.10,
    radiusY: 0.14,
    color: '#ffffff',
    accentColor: '#eab308',
    volume: 0.9,
    isCymbal: true
  },
  {
    id: 'hihat_open',
    name: 'Open Hi-Hat',
    label: 'OPEN HH',
    x: 0.32,
    y: 0.28,
    radiusX: 0.09,
    radiusY: 0.13,
    color: '#ffffff',
    accentColor: '#d4af37',
    volume: 0.85,
    isCymbal: true
  },
  {
    id: 'hihat_closed',
    name: 'Closed Hi-Hat',
    label: 'CLOSED HH',
    x: 0.14,
    y: 0.70,
    radiusX: 0.10,
    radiusY: 0.14,
    color: '#ffffff',
    accentColor: '#c29d38',
    volume: 0.85,
    isCymbal: true
  },
  {
    id: 'snare',
    name: 'Snare Drum',
    label: 'SNARE',
    x: 0.32,
    y: 0.70,
    radiusX: 0.11,
    radiusY: 0.16,
    color: '#ffffff',
    accentColor: '#d32f2f',
    volume: 0.95,
    isCymbal: false
  },
  // Center
  {
    id: 'kick',
    name: 'Bass Drum',
    label: 'KICK',
    x: 0.50,
    y: 0.80,
    radiusX: 0.12,
    radiusY: 0.14,
    color: '#ffffff',
    accentColor: '#1e293b',
    volume: 1.0,
    isCymbal: false
  },
  // Right Hand Zone
  {
    id: 'tom_high',
    name: 'High Tom',
    label: 'HIGH TOM',
    x: 0.68,
    y: 0.28,
    radiusX: 0.09,
    radiusY: 0.13,
    color: '#ffffff',
    accentColor: '#0284c7',
    volume: 0.85,
    isCymbal: false
  },
  {
    id: 'ride',
    name: 'Ride Cymbal',
    label: 'RIDE',
    x: 0.86,
    y: 0.28,
    radiusX: 0.10,
    radiusY: 0.14,
    color: '#ffffff',
    accentColor: '#ca8a04',
    volume: 0.9,
    isCymbal: true
  },
  {
    id: 'tom_low',
    name: 'Low Tom',
    label: 'LOW TOM',
    x: 0.76,
    y: 0.70,
    radiusX: 0.12,
    radiusY: 0.16,
    color: '#ffffff',
    accentColor: '#4f46e5',
    volume: 0.9,
    isCymbal: false
  }
];

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
