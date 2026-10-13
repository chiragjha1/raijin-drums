import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Header } from './Header';
import { Controls } from './Controls';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { CalibrationModal } from './CalibrationModal';
import { Metronome } from './Metronome';
import { cameraManager, CameraStatus } from '../camera/CameraManager';
import { handTracker } from '../vision/HandTracker';
import { audioEngine } from '../audio/AudioEngine';
import { HitDetector } from '../engine/HitDetector';
import { canvasRenderer } from '../rendering/CanvasRenderer';
import { performanceTracker } from '../diagnostics/PerformanceTracker';
import { STANDARD_KIT, MIRRORED_KIT, COMPACT_KIT } from '../drums/drumPresets';
import { DrumPad, PerformanceMetrics } from '../types';
import { AlertCircle, Camera, PlayCircle } from 'lucide-react';

export const VirtualDrumApp: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  // App UI State
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string>('');
  const [isAudioReady, setIsAudioReady] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [layout, setLayout] = useState<'standard' | 'mirrored' | 'compact'>('standard');
  const [singleDrumMode, setSingleDrumMode] = useState<boolean>(false);
  const [sensitivity, setSensitivity] = useState<number>(1.0);
  const [masterVolume, setMasterVolume] = useState<number>(0.85);
  const [predictiveMode, setPredictiveMode] = useState<boolean>(false);
  const [isMirroredView, setIsMirroredView] = useState<boolean>(true);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [calibrationMode, setCalibrationMode] = useState<boolean>(false);
  const [showMetronome, setShowMetronome] = useState<boolean>(false);
  const [activeHandsCount, setActiveHandsCount] = useState<number>(0);

  // Diagnostics metrics state for UI display
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    cameraFps: 0,
    inferenceDurationMs: 0,
    inferenceP95Ms: 0,
    trackingLatencyMs: 0,
    totalHits: 0,
    recentHitsPerSec: 0,
    audioBaseLatencyMs: 0,
    audioOutputLatencyMs: 0,
    droppedFrames: 0,
    activeHandsCount: 0,
    detectorStates: {}
  });

  // Hit detector engine instance
  const hitDetectorRef = useRef<HitDetector>(new HitDetector({
    velocitySensitivity: 1.0,
    predictiveMode: false
  }));

  // Drums according to layout & single drum mode
  const getActiveDrums = useCallback((): DrumPad[] => {
    let kit = STANDARD_KIT;
    if (layout === 'mirrored') kit = MIRRORED_KIT;
    else if (layout === 'compact') kit = COMPACT_KIT;

    if (singleDrumMode) {
      // Phase 1 Baseline: Solo Snare positioned centrally
      const snare = kit.find((d) => d.id === 'snare') || kit[0];
      return [{
        ...snare,
        x: 0.5,
        y: 0.65,
        radiusX: 0.16,
        radiusY: 0.14
      }];
    }
    return kit;
  }, [layout, singleDrumMode]);

  // Sync sensitivity and predictive mode with detector engine
  useEffect(() => {
    hitDetectorRef.current.setConfig({
      velocitySensitivity: sensitivity,
      predictiveMode: predictiveMode
    });
  }, [sensitivity, predictiveMode]);

  // Sync volume with audio engine
  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  // Sync mute with audio engine
  useEffect(() => {
    audioEngine.setMuted(isMuted);
  }, [isMuted]);

  // Initialize Web Audio on user gesture
  const ensureAudioInitialized = useCallback(async () => {
    try {
      await audioEngine.initialize();
      setIsAudioReady(true);
    } catch (err) {
      console.warn('Audio context initialization error:', err);
    }
  }, []);

  // Camera start / stop handler
  const handleToggleCamera = useCallback(async () => {
    await ensureAudioInitialized();

    if (cameraStatus === 'active') {
      cameraManager.stopCamera();
      setCameraStatus('idle');
      setActiveHandsCount(0);
      return;
    }

    if (!videoRef.current) return;

    try {
      setCameraStatus('requesting');
      setCameraError('');
      await cameraManager.startCamera(videoRef.current, {
        width: 640,
        height: 480,
        frameRate: 30
      });
      setCameraStatus('active');

      // Initialize MediaPipe vision pipeline
      await handTracker.initialize();
    } catch (err: unknown) {
      const error = err as Error;
      setCameraStatus(cameraManager.getStatus());
      setCameraError(cameraManager.getErrorMessage() || error.message);
    }
  }, [cameraStatus, ensureAudioInitialized]);

  // Master Real-Time Animation Loop
  useEffect(() => {
    let lastMetricUpdate = 0;

    const loop = (timestamp: number) => {
      performanceTracker.recordFrame(timestamp);

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (canvas && (!canvasRenderer['canvas'] || canvasRenderer['canvas'] !== canvas)) {
        canvasRenderer.setCanvas(canvas);
      }

      const activeDrums = getActiveDrums();

      if (video && video.readyState >= 2 && cameraStatus === 'active' && handTracker.getReady()) {
        performanceTracker.recordCameraFrame(timestamp);

        // 1. MediaPipe Inference
        const observations = handTracker.processVideoFrame(video, timestamp, isMirroredView);
        const inferenceTime = handTracker.getLastInferenceDuration();
        if (inferenceTime > 0) {
          performanceTracker.recordInference(inferenceTime);
        }

        if (observations.length > 0) {
          setActiveHandsCount(observations.length);

          // 2. Deterministic Hit Detection
          const hits = hitDetectorRef.current.process(observations, activeDrums, timestamp);

          // 3. Audio & Visual Trigger
          for (const hit of hits) {
            audioEngine.trigger(hit.drumId, hit.velocity);
            canvasRenderer.registerHit(hit);
            performanceTracker.recordHit(timestamp);
          }
        } else {
          setActiveHandsCount(0);
        }

        // 4. Render Canvas Overlay
        canvasRenderer.render(activeDrums, observations, timestamp, calibrationMode);
      } else {
        // Render drums even when camera is off
        canvasRenderer.render(activeDrums, [], timestamp, calibrationMode);
      }

      // Update diagnostic metrics state throttled to once every 200ms
      if (timestamp - lastMetricUpdate > 200) {
        lastMetricUpdate = timestamp;
        const currentMetrics = performanceTracker.getMetrics(
          audioEngine.getBaseLatency(),
          audioEngine.getOutputLatency(),
          activeHandsCount,
          hitDetectorRef.current.getAllStates()
        );
        setMetrics(currentMetrics);
      }

      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [cameraStatus, isMirroredView, calibrationMode, getActiveDrums, activeHandsCount]);

  // Adjust canvas resolution to parent container
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && videoRef.current) {
        const rect = videoRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvasRef.current.width = rect.width;
          canvasRef.current.height = rect.height;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    // Initial check
    const timer = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="raijin-app-container" onClick={ensureAudioInitialized}>
      {/* Top Header */}
      <Header
        cameraStatus={cameraStatus}
        isAudioReady={isAudioReady}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted((m) => !m)}
        onToggleCamera={handleToggleCamera}
        showDiagnostics={showDiagnostics}
        onToggleDiagnostics={() => setShowDiagnostics((d) => !d)}
        calibrationMode={calibrationMode}
        onToggleCalibration={() => setCalibrationMode((c) => !c)}
        metronomeActive={showMetronome}
        onToggleMetronome={() => setShowMetronome((m) => !m)}
        singleDrumMode={singleDrumMode}
        onToggleSingleDrumMode={() => setSingleDrumMode((s) => !s)}
      />

      {/* Main Playable Stage */}
      <main className="stage-container">
        <div className="viewport-wrapper">
          {/* Webcam Video (Mirrored if configured) */}
          <video
            ref={videoRef}
            className={`webcam-feed ${isMirroredView ? 'mirrored' : ''}`}
            playsInline
            muted
          />

          {/* Canvas 2D Overlay (Drums, Hand Skeleton, Hit Ripples) */}
          <canvas ref={canvasRef} className="overlay-canvas" />

          {/* Camera Idle or Permission Denied Overlay */}
          {cameraStatus !== 'active' && (
            <div className="camera-standby-overlay">
              <div className="standby-card">
                <div className="standby-crest">雷</div>
                <h2>RAIJIN VIRTUAL DRUM INSTRUMENT</h2>
                <p>
                  Experience zero-latency camera drumming powered by browser Web Audio DSP and
                  real-time hand tracking.
                </p>

                {cameraError ? (
                  <div className="camera-error-badge">
                    <AlertCircle size={16} />
                    <span>{cameraError}</span>
                  </div>
                ) : (
                  <div className="permission-note">
                    Camera frames are processed 100% locally in your browser. No video is ever uploaded.
                  </div>
                )}

                <button onClick={handleToggleCamera} className="start-experience-btn">
                  <Camera size={18} />
                  <span>カメラを起動 Start Camera & Play</span>
                </button>
              </div>
            </div>
          )}

          {/* Unmute/Initialize Audio Overlay prompt if audio not yet active */}
          {!isAudioReady && cameraStatus === 'active' && (
            <button className="audio-unlock-pill" onClick={ensureAudioInitialized}>
              <PlayCircle size={15} />
              <span>Click anywhere to activate Web Audio</span>
            </button>
          )}

          {/* Floating Metronome Card */}
          {showMetronome && <Metronome onClose={() => setShowMetronome(false)} />}
        </div>
      </main>

      {/* Controls Bar */}
      <Controls
        layout={layout}
        onChangeLayout={setLayout}
        sensitivity={sensitivity}
        onChangeSensitivity={setSensitivity}
        masterVolume={masterVolume}
        onChangeVolume={setMasterVolume}
        predictiveMode={predictiveMode}
        onTogglePredictiveMode={() => setPredictiveMode((p) => !p)}
        isMirroredView={isMirroredView}
        onToggleMirroredView={() => setIsMirroredView((m) => !m)}
      />

      {/* Diagnostics Modal / Drawer */}
      {showDiagnostics && (
        <DiagnosticsPanel
          metrics={metrics}
          onClose={() => setShowDiagnostics(false)}
          predictiveMode={predictiveMode}
        />
      )}

      {/* Calibration Guide Modal */}
      {calibrationMode && (
        <CalibrationModal
          onClose={() => setCalibrationMode(false)}
          activeHandsCount={activeHandsCount}
          totalHits={metrics.totalHits}
        />
      )}
    </div>
  );
};
