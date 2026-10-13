// RAIJIN Canvas 2D High-Performance Visualizer (English-Only Clean Modern Aesthetic)
import { DrumPad, HandObservation, HitEvent } from '../types';

export interface VisualImpact {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  opacity: number;
  startTime: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private impacts: VisualImpact[] = [];
  private activeDrumHits: Map<string, { time: number; velocity: number }> = new Map();

  public setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
  }

  public registerHit(hit: HitEvent): void {
    this.activeDrumHits.set(hit.drumId, {
      time: hit.timestamp,
      velocity: hit.velocity
    });

    // Add expanding impact ripple
    this.impacts.push({
      x: hit.strikePoint.x,
      y: hit.strikePoint.y,
      radius: 12,
      maxRadius: 70 + hit.velocity * 45,
      color: hit.drumId === 'snare' ? '#d32f2f' : '#2563eb',
      opacity: 0.85,
      startTime: hit.timestamp
    });
  }

  /**
   * Render frame: drums, hand skeletons, strike points, and animations.
   */
  public render(
    drums: DrumPad[],
    observations: HandObservation[],
    currentTime: number,
    calibrationMode = false
  ): void {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear transparent overlay
    ctx.clearRect(0, 0, width, height);

    // 1. Render Drum Surfaces
    for (const drum of drums) {
      this.renderDrum(ctx, drum, width, height, currentTime);
    }

    // 2. Render Impact Ripples
    this.renderImpacts(ctx, width, height, currentTime);

    // 3. Render Hand Landmarks & Skeletons
    for (const obs of observations) {
      this.renderHand(ctx, obs, width, height);
    }

    // 4. Render Calibration Grid if active
    if (calibrationMode) {
      this.renderCalibrationOverlay(ctx, width, height);
    }
  }

  private renderDrum(
    ctx: CanvasRenderingContext2D,
    drum: DrumPad,
    width: number,
    height: number,
    currentTime: number
  ): void {
    const cx = drum.x * width;
    const cy = drum.y * height;
    const rx = drum.radiusX * width;
    const ry = drum.radiusY * height;

    const hitInfo = this.activeDrumHits.get(drum.id);
    const timeSinceHit = hitInfo ? currentTime - hitInfo.time : 9999;
    const hitDecay = Math.max(0, 1 - timeSinceHit / 220); // 220ms decay

    const scale = 1.0 + hitDecay * 0.08 * (hitInfo ? hitInfo.velocity : 1);
    const currentRx = rx * scale;
    const currentRy = ry * scale;

    ctx.save();

    // Subtle drop shadow for clean modern depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.07)';
    ctx.shadowBlur = hitDecay > 0 ? 18 : 8;
    ctx.shadowOffsetY = 4;

    // Drum Base Ellipse
    ctx.beginPath();
    ctx.ellipse(cx, cy, currentRx, currentRy, 0, 0, Math.PI * 2);

    // Background fill: clean porcelain white, flash on hit
    if (hitDecay > 0) {
      ctx.fillStyle = `rgba(255, 245, 245, ${0.95 + hitDecay * 0.05})`;
    } else {
      ctx.fillStyle = drum.isCymbal ? 'rgba(254, 252, 235, 0.92)' : 'rgba(255, 255, 255, 0.92)';
    }
    ctx.fill();

    // Reset shadow for borders
    ctx.shadowColor = 'transparent';

    // Outer Rim Stroke
    ctx.beginPath();
    ctx.ellipse(cx, cy, currentRx, currentRy, 0, 0, Math.PI * 2);
    ctx.lineWidth = hitDecay > 0 ? 3.5 : 2.0;
    ctx.strokeStyle = hitDecay > 0 ? drum.accentColor : '#94a3b8';
    ctx.stroke();

    // Inner Concentric Ring
    ctx.beginPath();
    ctx.ellipse(cx, cy, currentRx * 0.86, currentRy * 0.86, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = hitDecay > 0 ? drum.accentColor : '#cbd5e1';
    ctx.stroke();
    ctx.setLineDash([]);

    // Struck Flash Ring
    if (hitDecay > 0) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, currentRx * 1.08, currentRy * 1.08, 0, 0, Math.PI * 2);
      ctx.lineWidth = 2.5 * hitDecay;
      ctx.strokeStyle = drum.accentColor;
      ctx.globalAlpha = hitDecay;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Clean English Primary Label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 14px "Inter", -apple-system, sans-serif';
    ctx.fillStyle = hitDecay > 0 ? drum.accentColor : '#0f172a';
    ctx.fillText(drum.label, cx, cy - 7);

    // English Subtitle
    ctx.font = '500 10.5px "Inter", -apple-system, sans-serif';
    ctx.fillStyle = hitDecay > 0 ? drum.accentColor : '#64748b';
    ctx.fillText(drum.name.toUpperCase(), cx, cy + 11);

    ctx.restore();
  }

  private renderImpacts(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentTime: number
  ): void {
    ctx.save();
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const imp = this.impacts[i];
      const elapsed = currentTime - imp.startTime;
      const progress = elapsed / 260; // 260ms ripple

      if (progress >= 1.0) {
        this.impacts.splice(i, 1);
        continue;
      }

      const currentRadius = imp.radius + (imp.maxRadius - imp.radius) * progress;
      const alpha = (1 - progress) * imp.opacity;

      ctx.beginPath();
      ctx.arc(imp.x * width, imp.y * height, currentRadius, 0, Math.PI * 2);
      ctx.strokeStyle = imp.color;
      ctx.lineWidth = 2.5 * (1 - progress);
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderHand(
    ctx: CanvasRenderingContext2D,
    obs: HandObservation,
    width: number,
    height: number
  ): void {
    const raw = obs.landmarks.raw;
    if (!raw || raw.length < 21) return;

    ctx.save();

    // Hand Skeleton Connections
    const connections = [
      // Thumb
      [0, 1], [1, 2], [2, 3], [3, 4],
      // Index
      [0, 5], [5, 6], [6, 7], [7, 8],
      // Middle
      [0, 9], [9, 10], [10, 11], [11, 12],
      // Ring
      [0, 13], [13, 14], [14, 15], [15, 16],
      // Pinky
      [0, 17], [17, 18], [18, 19], [19, 20],
      // Palm cross
      [5, 9], [9, 13], [13, 17]
    ];

    // Clean ink lines for hand bones
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [from, to] of connections) {
      const p1 = raw[from];
      const p2 = raw[to];
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    }

    // Joints: white nodes with ink outline
    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      const px = p.x * width;
      const py = p.y * height;
      const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;

      ctx.beginPath();
      ctx.arc(px, py, isTip ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? '#d32f2f' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    }

    // Primary Strike Point: Target crosshair
    const sx = obs.strikePoint.x * width;
    const sy = obs.strikePoint.y * height;

    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#d32f2f';
    ctx.fill();

    // Hand label badge (English)
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    const wrist = obs.landmarks.wrist;
    ctx.fillText(
      `${obs.handedness.toUpperCase()} (${Math.round(obs.confidence * 100)}%)`,
      wrist.x * width,
      wrist.y * height + 18
    );

    ctx.restore();
  }

  private renderCalibrationOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(211, 47, 47, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);

    // Center guide
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    // Playing zone horizontal comfort band
    ctx.beginPath();
    ctx.moveTo(0, height * 0.35);
    ctx.lineTo(width, height * 0.35);
    ctx.moveTo(0, height * 0.9);
    ctx.lineTo(width, height * 0.9);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.font = '600 12px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(211, 47, 47, 0.85)';
    ctx.fillText('OPTIMAL STRIKE ZONE (35% – 90%)', 24, height * 0.38);

    ctx.restore();
  }
}

export const canvasRenderer = new CanvasRenderer();
