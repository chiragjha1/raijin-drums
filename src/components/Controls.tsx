import React from 'react';
import { Sparkles, Eye, SlidersHorizontal } from 'lucide-react';

interface ControlsProps {
  layout: 'standard' | 'mirrored' | 'compact';
  onChangeLayout: (layout: 'standard' | 'mirrored' | 'compact') => void;
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
  masterVolume: number;
  onChangeVolume: (val: number) => void;
  predictiveMode: boolean;
  onTogglePredictiveMode: () => void;
  isMirroredView: boolean;
  onToggleMirroredView: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  layout,
  onChangeLayout,
  sensitivity,
  onChangeSensitivity,
  masterVolume,
  onChangeVolume,
  predictiveMode,
  onTogglePredictiveMode,
  isMirroredView,
  onToggleMirroredView
}) => {
  return (
    <div className="controls-bar">
      {/* Layout Presets */}
      <div className="control-group">
        <label className="control-label">
          <span className="kanji-sub">配置</span>
          <span>Kit Layout</span>
        </label>
        <div className="btn-toggle-group">
          <button
            className={`toggle-option ${layout === 'standard' ? 'selected' : ''}`}
            onClick={() => onChangeLayout('standard')}
          >
            標準 Standard
          </button>
          <button
            className={`toggle-option ${layout === 'mirrored' ? 'selected' : ''}`}
            onClick={() => onChangeLayout('mirrored')}
          >
            反転 Left-Handed
          </button>
          <button
            className={`toggle-option ${layout === 'compact' ? 'selected' : ''}`}
            onClick={() => onChangeLayout('compact')}
          >
            凝縮 Compact
          </button>
        </div>
      </div>

      {/* Sensitivity Slider */}
      <div className="control-group">
        <div className="slider-label-row">
          <label className="control-label">
            <SlidersHorizontal size={13} />
            <span className="kanji-sub">感度</span>
            <span>Sensitivity</span>
          </label>
          <span className="slider-value">{Math.round(sensitivity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          value={sensitivity}
          onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
          className="raijin-slider"
        />
      </div>

      {/* Master Volume */}
      <div className="control-group">
        <div className="slider-label-row">
          <label className="control-label">
            <span className="kanji-sub">音量</span>
            <span>Master Volume</span>
          </label>
          <span className="slider-value">{Math.round(masterVolume * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={masterVolume}
          onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
          className="raijin-slider"
        />
      </div>

      {/* Camera Mirror View Toggle */}
      <div className="control-group">
        <label className="control-label">
          <Eye size={13} />
          <span className="kanji-sub">鏡像</span>
          <span>Mirror View</span>
        </label>
        <button
          onClick={onToggleMirroredView}
          className={`switch-toggle ${isMirroredView ? 'switch-active' : ''}`}
        >
          <span className="switch-knob" />
          <span className="switch-text">{isMirroredView ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Predictive Trigger Mode Toggle */}
      <div className="control-group">
        <label className="control-label" title="Experimental Trajectory Lookahead">
          <Sparkles size={13} />
          <span className="kanji-sub">予測</span>
          <span>Predictive Mode</span>
        </label>
        <button
          onClick={onTogglePredictiveMode}
          className={`switch-toggle ${predictiveMode ? 'switch-active' : ''}`}
        >
          <span className="switch-knob" />
          <span className="switch-text">{predictiveMode ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
};
