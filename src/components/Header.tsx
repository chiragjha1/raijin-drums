import React from 'react';
import { CameraStatus } from '../camera/CameraManager';
import { Volume2, VolumeX, Camera, CameraOff, Activity, Sliders, Music } from 'lucide-react';

interface HeaderProps {
  cameraStatus: CameraStatus;
  isAudioReady: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  showDiagnostics: boolean;
  onToggleDiagnostics: () => void;
  calibrationMode: boolean;
  onToggleCalibration: () => void;
  metronomeActive: boolean;
  onToggleMetronome: () => void;
  singleDrumMode: boolean;
  onToggleSingleDrumMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cameraStatus,
  isAudioReady,
  isMuted,
  onToggleMute,
  onToggleCamera,
  showDiagnostics,
  onToggleDiagnostics,
  calibrationMode,
  onToggleCalibration,
  metronomeActive,
  onToggleMetronome,
  singleDrumMode,
  onToggleSingleDrumMode
}) => {
  return (
    <header className="header-container">
      {/* Brand & Logo */}
      <div className="brand-section">
        <div className="logo-wrapper">
          <img src="/raijin-logo.png" alt="RAIJIN Logo" className="brand-logo" />
        </div>
        <div className="brand-subtext">
          <span className="kanji-badge">雷神</span>
          <span className="brand-tagline">Low-Latency Virtual Drum Instrument</span>
        </div>
      </div>

      {/* Status Badges */}
      <div className="status-badges">
        {/* Camera Status */}
        <div className={`status-pill ${cameraStatus === 'active' ? 'status-active' : 'status-inactive'}`}>
          <span className="status-dot" />
          <span className="status-text">
            {cameraStatus === 'active'
              ? 'Camera Live'
              : cameraStatus === 'requesting'
              ? 'Starting Camera...'
              : cameraStatus === 'denied'
              ? 'Camera Denied'
              : 'Camera Standby'}
          </span>
        </div>

        {/* Audio Status */}
        <div className={`status-pill ${isAudioReady ? 'status-active' : 'status-pending'}`}>
          <span className="status-dot" />
          <span className="status-text">
            {isAudioReady ? 'Audio Ready (Low Latency)' : 'Click to Enable Audio'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="header-actions">
        {/* Kit Mode Switch */}
        <button
          onClick={onToggleSingleDrumMode}
          className={`action-btn ${singleDrumMode ? 'btn-selected' : ''}`}
          title="Toggle between Solo Snare (Phase 1 Baseline) and Full 8-Piece Kit"
        >
          <span className="action-kanji">太鼓</span>
          <span>{singleDrumMode ? 'Solo Snare' : '8-Piece Kit'}</span>
        </button>

        {/* Metronome */}
        <button
          onClick={onToggleMetronome}
          className={`action-btn ${metronomeActive ? 'btn-selected' : ''}`}
          title="Metronome / Practice Mode"
        >
          <Music size={15} />
          <span>拍子</span>
        </button>

        {/* Calibration Mode */}
        <button
          onClick={onToggleCalibration}
          className={`action-btn ${calibrationMode ? 'btn-selected' : ''}`}
          title="Calibration Guides"
        >
          <Sliders size={15} />
          <span>校正</span>
        </button>

        {/* Diagnostics Toggle */}
        <button
          onClick={onToggleDiagnostics}
          className={`action-btn ${showDiagnostics ? 'btn-selected' : ''}`}
          title="Toggle Real-Time Diagnostics & Latency Metrics"
        >
          <Activity size={15} />
          <span>計測</span>
        </button>

        {/* Audio Mute/Unmute */}
        <button
          onClick={onToggleMute}
          className={`action-btn icon-only ${isMuted ? 'btn-alert' : ''}`}
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`action-btn primary-btn ${cameraStatus === 'active' ? 'btn-active-cam' : ''}`}
        >
          {cameraStatus === 'active' ? (
            <>
              <CameraOff size={15} />
              <span>停止 Stop</span>
            </>
          ) : (
            <>
              <Camera size={15} />
              <span>起動 Start</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
