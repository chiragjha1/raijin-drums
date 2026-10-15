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
import { STANDARD_KIT, MIRRORED_KIT, COMPACT_KIT, TABLETOP_KIT, isPointInsideDrum } from '../drums/drumPresets';
import { DrumPad, PerformanceMetrics } from '../types';
import { AlertCircle, Camera, PlayCircle, Disc3, RotateCcw } from 'lucide-react';

export const VirtualDrumApp: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | null>(null);

  // App UI State
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string>('');
  const [isAudioReady, setIsAudioReady] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [layout, setLayout] = useState<'standard' | 'mirrored' | 'compact' | 'tabletop'>('standard');
  const [singleDrumMode, setSingleDrumMode] = useState<boolean>(false);
  const [sensitivity, setSensitivity] = useState<number>(1.2);
  const [masterVolume, setMasterVolume] = useState<number>(0.9);
  const [predictiveMode, setPredictiveMode] = useState<boolean>(false);
  const [isMirroredView, setIsMirroredView] = useState<boolean>(true);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [calibrationMode, setCalibrationMode] = useState<boolean>(false);
  const [showMetronome, setShowMetronome] = useState<boolean>(false);
  const [activeHandsCount, setActiveHandsCount] = useState<number>(0);

  // Mobile Orientation States
  const [isMobilePortrait, setIsMobilePortrait] = useState<boolean>(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState<boolean>(false);

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
    minDownwardVelocity: 0.28,
    rearmCooldownMs: 75,
    velocitySensitivity: 1.2,
    predictiveMode: false
  }));

  // Detect mobile device and rotation changes
  useEffect(() => {
    const handleOrientation = () => {
      const isNarrow = window.innerWidth <= 950;
      const isLandscape = window.innerWidth > window.innerHeight;
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      if ((isNarrow || isTouch) && !isLandscape) {
        setIsMobilePortrait(true);
        setIsMobileLandscape(false);
      } else if (isLandscape && (isNarrow || isTouch)) {
        setIsMobilePortrait(false);
        setIsMobileLandscape(true);
        // Automatically adapt drum layout to Tabletop Split (left & right wings)
        setLayout((prev) => (prev === 'standard' ? 'tabletop' : prev));
      } else {
        setIsMobilePortrait(false);
        setIsMobileLandscape(false);
      }
    };

    handleOrientation();
    window.addEventListener('resize', handleOrientation);
    window.addEventListener('orientationchange', handleOrientation);
    return () => {
      window.removeEventListener('resize', handleOrientation);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

  // Request fullscreen landscape on mobile
  const requestLandscape = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      const orientation = screen.orientation as unknown as { lock?: (mode: string) => Promise<void> };
      if (orientation && orientation.lock) {
        await orientation.lock('landscape');
      }
    } catch {
      // Fallback if orientation lock not granted
    }
  };

  // Drums according to layout & single drum mode
  const getActiveDrums = useCallback((): DrumPad[] => {
    let kit = STANDARD_KIT;
    if (layout === 'tabletop') kit = TABLETOP_KIT;
    else if (layout === 'mirrored') kit = MIRRORED_KIT;
    else if (layout === 'compact') kit = COMPACT_KIT;

    if (singleDrumMode) {
      const snare = kit.find((d) => d.id === 'snare') || kit[0];
      return [{
        ...snare,
        x: 0.5,
        y: 0.65,
        radiusX: 0.17,
        radiusY: 0.15
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
      await audioEngine.resume();
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

  // Click-to-play direct test trigger
  const handleStageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    ensureAudioInitialized();

    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const drums = getActiveDrums();
    for (const drum of drums) {
      if (isPointInsideDrum({ x, y }, drum)) {
        audioEngine.trigger(drum.id, 0.9);
        canvasRenderer.registerHit({
          drumId: drum.id,
          handId: 'mouse_click',
          handedness: 'Right',
          timestamp: performance.now(),
          strikePoint: { x, y },
          velocity: 0.9,
          rawDownwardVelocity: 1.0
        });
        performanceTracker.recordHit(performance.now());
        break;
      }
    }
  }, [ensureAudioInitialized, getActiveDrums]);

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

  // Synchronize canvas resolution with viewport element
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvasRef.current.width = rect.width;
          canvasRef.current.height = rect.height;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={`raijin-app-container ${isMobileLandscape ? 'mobile-landscape-active' : ''}`} onClick={ensureAudioInitialized}>
      {/* Mobile Portrait Orientation Prompt */}
      {isMobilePortrait && (
        <div className="portrait-rotation-banner">
          <div className="rotation-hint-content">
            <RotateCcw className="rotate-icon-spin" size={18} />
            <div className="rotate-hint-text">
              <strong>Rotate Phone Horizontally</strong>
              <span>Place your phone flat or tilted on a table to play with Left & Right hand zones</span>
            </div>
            <button className="rotate-fullscreen-btn" onClick={requestLandscape}>
              Flip to Landscape
            </button>
            <button className="rotate-dismiss-btn" onClick={() => setIsMobilePortrait(false)}>
              ✕
            </button>
          </div>
        </div>
      )}

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
        <div
          ref={viewportRef}
          className={`viewport-wrapper ${isMobileLandscape ? 'landscape-viewport' : ''}`}
          onClick={handleStageClick}
        >
          {/* Webcam Video Feed */}
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
                <div className="standby-icon-wrapper">
                  <Disc3 size={36} className="text-vermilion" />
                </div>
                <h2>RAIJIN VIRTUAL DRUM INSTRUMENT</h2>
                <p>
                  Place your phone horizontally on a table. Play with your left hand on the left wing
                  and right hand on the right wing.
                </p>

                {cameraError ? (
                  <div className="camera-error-badge">
                    <AlertCircle size={16} />
                    <span>{cameraError}</span>
                  </div>
                ) : (
                  <div className="permission-note">
                    Camera frames are processed 100% locally in your browser. No video is ever recorded or uploaded.
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleCamera();
                  }}
                  className="start-experience-btn"
                >
                  <Camera size={18} />
                  <span>Start Camera & Play</span>
                </button>
              </div>
            </div>
          )}

          {/* Audio initialization reminder if needed */}
          {!isAudioReady && cameraStatus === 'active' && (
            <button
              className="audio-unlock-pill"
              onClick={(e) => {
                e.stopPropagation();
                ensureAudioInitialized();
              }}
            >
              <PlayCircle size={15} />
              <span>Tap anywhere to activate audio</span>
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
