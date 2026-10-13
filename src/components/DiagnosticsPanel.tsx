import React from 'react';
import { PerformanceMetrics } from '../types';
import { X, Activity, Cpu, Volume2, Target } from 'lucide-react';

interface DiagnosticsPanelProps {
  metrics: PerformanceMetrics;
  onClose: () => void;
  predictiveMode: boolean;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  metrics,
  onClose,
  predictiveMode
}) => {
  return (
    <div className="diagnostics-overlay">
      <div className="diagnostics-card">
        {/* Header */}
        <div className="diag-header">
          <div className="diag-title">
            <Activity size={18} className="text-vermilion" />
            <h3>実時間計測 Diagnostics & Latency Metrics</h3>
          </div>
          <button onClick={onClose} className="close-btn" title="Close Panel">
            <X size={16} />
          </button>
        </div>

        {/* Grid Metrics */}
        <div className="diag-grid">
          {/* Tracking / Vision Performance */}
          <div className="diag-section">
            <div className="section-title">
              <Cpu size={14} />
              <span>Computer Vision & Tracking</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Pipeline Rate (FPS)</span>
              <span className="metric-val highlight">{metrics.fps.toFixed(1)}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Camera Stream FPS</span>
              <span className="metric-val">{metrics.cameraFps.toFixed(1)}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Inference Duration (Mean)</span>
              <span className={`metric-val ${metrics.inferenceDurationMs < 25 ? 'val-good' : 'val-warn'}`}>
                {metrics.inferenceDurationMs.toFixed(1)} ms
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Inference P95 (95th %)</span>
              <span className="metric-val">{metrics.inferenceP95Ms.toFixed(1)} ms</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Active Hands Tracked</span>
              <span className="metric-val">{metrics.activeHandsCount}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Dropped / Skipped Frames</span>
              <span className="metric-val">{metrics.droppedFrames}</span>
            </div>
          </div>

          {/* Audio Engine Performance */}
          <div className="diag-section">
            <div className="section-title">
              <Volume2 size={14} />
              <span>Web Audio DSP Latency</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Audio Context Base Latency</span>
              <span className="metric-val val-good">{metrics.audioBaseLatencyMs.toFixed(1)} ms</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Output Device Latency</span>
              <span className="metric-val">{metrics.audioOutputLatencyMs.toFixed(1)} ms</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Sample Architecture</span>
              <span className="metric-val">Decoded PCM AudioBuffers</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Audio Thread Allocation</span>
              <span className="metric-val val-good">Zero Runtime Allocations</span>
            </div>
          </div>

          {/* Hit Detection Engine Statistics */}
          <div className="diag-section">
            <div className="section-title">
              <Target size={14} />
              <span>Hit Detector Statistics</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Total Verified Hits</span>
              <span className="metric-val highlight">{metrics.totalHits}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Strike Rate</span>
              <span className="metric-val">{metrics.recentHitsPerSec.toFixed(1)} hits/sec</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Predictive Lookahead</span>
              <span className={`metric-val ${predictiveMode ? 'val-warn' : ''}`}>
                {predictiveMode ? 'Active (15ms lead)' : 'Disabled (Deterministic)'}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">False Trigger Guard</span>
              <span className="metric-val val-good">Active (Vector & Cooldown)</span>
            </div>
          </div>
        </div>

        {/* Live Detector FSM States */}
        <div className="fsm-states-section">
          <h4>Hand Detector States (FSM)</h4>
          <div className="fsm-tags">
            {Object.entries(metrics.detectorStates).length === 0 ? (
              <span className="fsm-empty">No active hand interactions yet. Bring hands in view.</span>
            ) : (
              Object.entries(metrics.detectorStates).map(([key, state]) => (
                <div key={key} className={`fsm-pill state-${state.toLowerCase()}`}>
                  <span className="fsm-key">{key}</span>
                  <span className="fsm-state">{state}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="diag-footer">
          <span>* End-to-end latency includes camera capture, USB bus, MediaPipe inference, and audio playback.</span>
        </div>
      </div>
    </div>
  );
};
