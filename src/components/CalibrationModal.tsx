import React from 'react';
import { X, CheckCircle, Crosshair, ArrowDown } from 'lucide-react';

interface CalibrationModalProps {
  onClose: () => void;
  activeHandsCount: number;
  totalHits: number;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  onClose,
  activeHandsCount,
  totalHits
}) => {
  return (
    <div className="modal-backdrop">
      <div className="calibration-modal-card">
        <div className="modal-header">
          <div className="modal-title">
            <Crosshair size={18} className="text-vermilion" />
            <h3>Calibration & Setup Guide</h3>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={16} />
          </button>
        </div>

        <div className="calibration-steps">
          <div className="step-item">
            <div className={`step-badge ${activeHandsCount > 0 ? 'badge-complete' : 'badge-pending'}`}>
              1
            </div>
            <div className="step-content">
              <h4>Hand Tracking Check</h4>
              <p>Position yourself so both hands and wrists are clearly visible to the camera.</p>
              <span className={`step-status ${activeHandsCount > 0 ? 'text-green' : 'text-slate'}`}>
                {activeHandsCount > 0
                  ? `✓ Detected ${activeHandsCount} hand(s)`
                  : 'Waiting for hands in frame...'}
              </span>
            </div>
          </div>

          <div className="step-item">
            <div className="step-badge">2</div>
            <div className="step-content">
              <h4>Downward Strike Technique</h4>
              <p>
                Strike drums with a decisive downward motion (<ArrowDown size={12} className="inline-icon" />).
                The engine registers leading fingertips or hands crossing into virtual pads.
              </p>
            </div>
          </div>

          <div className="step-item">
            <div className="step-badge">3</div>
            <div className="step-content">
              <h4>Reachable Area & Sensitivity</h4>
              <p>
                If hits feel too hard to trigger, increase <strong>Sensitivity</strong> in the bottom bar.
                You can also switch to <strong>Compact</strong> layout for smaller arm movements.
              </p>
            </div>
          </div>

          <div className="step-item">
            <div className={`step-badge ${totalHits > 0 ? 'badge-complete' : 'badge-pending'}`}>
              4
            </div>
            <div className="step-content">
              <h4>Live Drum Test</h4>
              <p>Strike the central Snare or Kick drum in front of you.</p>
              <span className={`step-status ${totalHits > 0 ? 'text-green' : 'text-slate'}`}>
                {totalHits > 0 ? `✓ ${totalHits} hit(s) successfully registered!` : 'Strike a drum to test audio.'}
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="confirm-btn">
            <CheckCircle size={15} />
            <span>Done & Start Playing</span>
          </button>
        </div>
      </div>
    </div>
  );
};
